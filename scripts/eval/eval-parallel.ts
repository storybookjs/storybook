import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fork } from "node:child_process";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import pc from "picocolors";
import { AGENTS, PROJECTS } from "./config.ts";
import type { TrialResult } from "./types.ts";
import { createLogger, formatDuration, formatCost, listPrompts } from "./lib/utils.ts";

const logger = createLogger();

const { values: opts } = parseArgs({
  options: {
    project: { type: "string", short: "p" },
    agent: { type: "string", short: "a" },
    model: { type: "string", short: "m" },
    prompt: { type: "string" },
    effort: { type: "string", short: "e", default: "high" },
    "upload-id": { type: "string", short: "u" },
  },
});

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  logger.log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

const prompts = opts.prompt ? opts.prompt.split(",") : listPrompts();
const modelFilter = opts.model ? opts.model.split(",") : null;
const agentFilter = opts.agent ? opts.agent.split(",") : null;
const effort = opts.effort as string;
const runId = randomUUID().slice(0, 8);
const uploadId = opts["upload-id"] || `eval-${runId}`;
const evalScript = resolve(import.meta.dirname, "eval.ts");

// Build all combos: every agent x model x prompt (with optional filters)
const runs: Array<{ agent: string; model: string; prompt: string; label: string }> = [];
for (const [agent, { models }] of Object.entries(AGENTS)) {
  if (agentFilter && !agentFilter.includes(agent)) continue;
  for (const model of models) {
    if (modelFilter && !modelFilter.includes(model)) continue;
    for (const prompt of prompts) {
      runs.push({ agent, model, prompt, label: `${model}+${prompt}` });
    }
  }
}

if (runs.length === 0) {
  logger.log(pc.red("No matching agent/model/prompt combinations found."));
  process.exit(1);
}

logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
logger.log(`${runs.length} parallel processes | Effort: ${effort}`);
for (const [agent, { models }] of Object.entries(AGENTS)) {
  const filteredModels = models.filter((m) => runs.some((r) => r.model === m));
  if (filteredModels.length > 0) {
    logger.log(`  ${agent}: ${filteredModels.join(", ")}`);
  }
}
logger.log(`  prompts: ${[...new Set(runs.map((r) => r.prompt))].join(", ")}`);
logger.log(`Run: ${runId}\n`);

function spawnRun(agent: string, model: string, prompt: string, label: string): Promise<TrialResult | null> {
  return new Promise((res) => {
    const tag = pc.dim(`[${label}]`);
    const child = fork(evalScript, [
      "-p", project!.name, "-a", agent, "-m", model, "-e", effort, "--prompt", prompt, "-u", uploadId,
    ], { stdio: ["ignore", "pipe", "pipe", "ipc"] });

    let result: TrialResult | null = null;

    // Receive structured result via IPC
    child.on("message", (msg: TrialResult) => {
      result = msg;
    });

    // Stream stdout/stderr with prefix for readability
    if (child.stdout) {
      createInterface({ input: child.stdout }).on("line", (line) => {
        logger.log(`${tag} ${line}`);
      });
    }
    if (child.stderr) {
      createInterface({ input: child.stderr }).on("line", (line) => {
        logger.log(`${tag} ${pc.dim(line)}`);
      });
    }

    child.on("close", (code) => {
      if (code !== 0 && !result) logger.logError(`${tag} exited with code ${code}`);
      res(result);
    });
  });
}

const results = (await Promise.all(runs.map((r) => spawnRun(r.agent, r.model, r.prompt, r.label)))).filter(
  (r): r is TrialResult => r != null,
);

if (results.length > 0) {
  results.sort((a, b) => (b.grading.ghostStories?.successRate ?? -1) - (a.grading.ghostStories?.successRate ?? -1));

  logger.log(pc.bold("\n\nResults (sorted by ghost stories rate)"));
  logger.log("=".repeat(130));
  logger.log(
    ["Agent", "Model", "Prompt", "Build", "Ghost", "TS Err", "Score", "Cost", "Time", "Turns"]
      .map((h, i) => h.padEnd(i <= 1 ? 14 : i === 2 ? 12 : 10))
      .join(" | "),
  );
  logger.log("-".repeat(130));

  for (const r of results) {
    const ghost = r.grading.ghostStories;
    const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";
    logger.log(
      [
        r.agent.padEnd(14),
        r.model.padEnd(14),
        r.prompt.padEnd(12),
        (r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL")).padEnd(10 + 10),
        ghostStr.padEnd(10),
        String(r.grading.typeCheckErrors).padEnd(10),
        String(r.quality.score).padEnd(10),
        formatCost(r.execution.cost).padEnd(10),
        formatDuration(r.execution.duration).padEnd(10),
        String(r.execution.turns).padEnd(10),
      ].join(" | "),
    );
  }

  logger.log("-".repeat(130));
  const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
  const ghostRates = results.map((r) => r.grading.ghostStories?.successRate).filter((r): r is number => r != null);
  const avgGhost = ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

  logger.log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
  logger.log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

logger.log("\nDone.");
