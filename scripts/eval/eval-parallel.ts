import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Command } from "commander";
import pc from "picocolors";
import { AGENTS } from "./types.ts";
import type { AgentName, TrialResult } from "./types.ts";
import { PROJECTS } from "./config.ts";
import { listPrompts } from "./lib/generate-prompt.ts";
import { formatDuration, formatCost } from "./lib/utils.ts";

const program = new Command()
  .name("eval-parallel")
  .description("Run all agent×model×prompt combos in parallel for one project")
  .option("-p, --project <name>", "project to evaluate")
  .option("-e, --effort <level>", "effort: low, medium, high, max", "high")
  .option("-u, --upload-id <id>", "upload ID for Google Sheets");

program.parse();
const opts = program.opts();

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  console.log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

const prompts = listPrompts();
const effort = opts.effort as string;
const runId = randomUUID().slice(0, 8);
const uploadId = (opts.uploadId as string) || `eval-${runId}`;
const evalScript = resolve(import.meta.dirname, "eval.ts");

// Build all combos: every agent × model × prompt
const runs: Array<{ agent: string; model: string; prompt: string; label: string }> = [];
for (const [agent, { models }] of Object.entries(AGENTS)) {
  for (const model of models) {
    for (const prompt of prompts) {
      runs.push({ agent, model, prompt, label: `${model}+${prompt}` });
    }
  }
}

console.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
console.log(`${runs.length} parallel processes | Effort: ${effort}`);
for (const [agent, { models }] of Object.entries(AGENTS)) {
  console.log(`  ${agent}: ${models.join(", ")}`);
}
console.log(`  prompts: ${prompts.join(", ")}`);
console.log(`Run: ${runId}\n`);

function spawnRun(agent: string, model: string, prompt: string, label: string): Promise<TrialResult | null> {
  return new Promise((res) => {
    const tag = pc.dim(`[${label}]`);
    const child = spawn("node", [
      evalScript, "-p", project!.name, "-a", agent, "-m", model, "-e", effort, "--prompt", prompt, "-u", uploadId,
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let result: TrialResult | null = null;

    createInterface({ input: child.stdout! }).on("line", (line) => {
      if (line.startsWith("__RESULT__")) {
        try { result = JSON.parse(line.slice("__RESULT__".length)); } catch { /* skip */ }
      } else {
        console.log(`${tag} ${line}`);
      }
    });

    createInterface({ input: child.stderr! }).on("line", (line) => {
      console.log(`${tag} ${pc.dim(line)}`);
    });

    child.on("close", (code) => {
      if (code !== 0 && !result) console.log(pc.red(`${tag} exited with code ${code}`));
      res(result);
    });
  });
}

const results = (await Promise.all(runs.map((r) => spawnRun(r.agent, r.model, r.prompt, r.label)))).filter(
  (r): r is TrialResult => r != null,
);

if (results.length > 0) {
  results.sort((a, b) => (b.grading.ghostStories?.successRate ?? -1) - (a.grading.ghostStories?.successRate ?? -1));

  console.log(pc.bold("\n\nResults (sorted by ghost stories rate)"));
  console.log("=".repeat(120));
  console.log(
    ["Agent", "Model", "Prompt", "Build", "Ghost", "TS Err", "Cost", "Time", "Turns"]
      .map((h, i) => h.padEnd(i <= 1 ? 14 : i === 2 ? 12 : 10))
      .join(" | "),
  );
  console.log("-".repeat(120));

  for (const r of results) {
    const ghost = r.grading.ghostStories;
    const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";
    console.log(
      [
        r.agent.padEnd(14),
        r.model.padEnd(14),
        r.prompt.padEnd(12),
        (r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL")).padEnd(10 + 10),
        ghostStr.padEnd(10),
        String(r.grading.typeCheckErrors).padEnd(10),
        formatCost(r.execution.cost).padEnd(10),
        formatDuration(r.execution.duration).padEnd(10),
        String(r.execution.turns).padEnd(10),
      ].join(" | "),
    );
  }

  console.log("-".repeat(120));
  const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
  const ghostRates = results.map((r) => r.grading.ghostStories?.successRate).filter((r): r is number => r != null);
  const avgGhost = ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

  console.log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
  console.log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

console.log("\nDone.");
