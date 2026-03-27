import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Command } from "commander";
import pc from "picocolors";
import { MODELS, effortForModel } from "./types.ts";
import { PROJECTS } from "./config.ts";
import { listPrompts } from "./lib/generate-prompt.ts";
import { formatDuration, formatCost } from "./lib/utils.ts";
import type { TrialResult } from "./types.ts";

const program = new Command()
  .name("eval-parallel")
  .description("Run all 4 models × 2 prompts = 8 evals in parallel (separate processes)")
  .option("-p, --project <name>", "project to evaluate")
  .option("-u, --upload-id <id>", "upload ID for Google Sheets");

program.parse();
const opts = program.opts();

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  console.log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

const prompts = listPrompts();
const runId = randomUUID().slice(0, 8);
const uploadId = (opts.uploadId as string) || `eval-${runId}`;
const evalScript = resolve(import.meta.dirname, "eval.ts");

const runs: Array<{ model: string; prompt: string; label: string }> = [];
for (const m of MODELS) {
  for (const prompt of prompts) {
    runs.push({ model: m.id, prompt, label: `${m.label}+${prompt}` });
  }
}

console.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
console.log(`${runs.length} parallel processes: ${MODELS.map((m) => m.label).join(", ")} × ${prompts.join(", ")}`);
console.log(`Run: ${runId}\n`);

/** Spawn a child, stream its output line-by-line with a prefix, return the TrialResult. */
function spawnRun(model: string, prompt: string, label: string): Promise<TrialResult | null> {
  return new Promise((resolve) => {
    const effort = effortForModel(model, "high");
    const tag = pc.dim(`[${label}]`);

    const child = spawn("node", [evalScript, "-p", project!.name, "-m", model, "-e", effort, "--prompt", prompt, "-u", uploadId], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let result: TrialResult | null = null;

    // Live-stream stdout with prefix
    const outRL = createInterface({ input: child.stdout! });
    outRL.on("line", (line) => {
      if (line.startsWith("__RESULT__")) {
        try { result = JSON.parse(line.slice("__RESULT__".length)); } catch { /* skip */ }
      } else {
        console.log(`${tag} ${line}`);
      }
    });

    // Live-stream stderr with prefix (agent logs go here)
    const errRL = createInterface({ input: child.stderr! });
    errRL.on("line", (line) => {
      console.log(`${tag} ${pc.dim(line)}`);
    });

    child.on("close", (code) => {
      if (code !== 0 && !result) {
        console.log(pc.red(`${tag} exited with code ${code}`));
      }
      resolve(result);
    });
  });
}

// Run all in parallel
const results = (await Promise.all(runs.map((r) => spawnRun(r.model, r.prompt, r.label)))).filter(
  (r): r is TrialResult => r != null,
);

// Summary table sorted by ghost stories rate
if (results.length > 0) {
  results.sort((a, b) => (b.grading.ghostStories?.successRate ?? -1) - (a.grading.ghostStories?.successRate ?? -1));

  console.log(pc.bold("\n\nResults (sorted by ghost stories rate)"));
  console.log("=".repeat(110));
  console.log(
    ["Model", "Prompt", "Build", "Ghost", "TS Err", "Cost", "Time", "Turns"]
      .map((h, i) => h.padEnd(i === 0 ? 22 : i === 1 ? 12 : 10))
      .join(" | "),
  );
  console.log("-".repeat(110));

  for (const r of results) {
    const ghost = r.grading.ghostStories;
    const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";
    console.log(
      [
        r.model.padEnd(22),
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

  console.log("-".repeat(110));
  const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
  const ghostRates = results.map((r) => r.grading.ghostStories?.successRate).filter((r): r is number => r != null);
  const avgGhost = ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

  console.log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
  console.log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

console.log("\nDone.");
