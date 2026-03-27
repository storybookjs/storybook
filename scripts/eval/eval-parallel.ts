import { randomUUID } from "node:crypto";
import { Command } from "commander";
import pc from "picocolors";
import type { TrialConfig, TrialResult } from "./types.ts";
import { MODELS, effortForModel } from "./types.ts";
import { PROJECTS } from "./config.ts";
import { runTask } from "./lib/run-task.ts";
import { listPrompts } from "./lib/generate-prompt.ts";
import { log, formatDuration, formatCost, createLogger } from "./lib/utils.ts";

const program = new Command()
  .name("eval-parallel")
  .description("Run all 4 models × 2 prompts = 8 evals in parallel for one project")
  .option("-p, --project <name>", "project to evaluate")
  .option("-u, --upload-id <id>", "upload ID for Google Sheets");

program.parse();
const opts = program.opts();

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

const prompts = listPrompts();
const runId = randomUUID().slice(0, 8);
const uploadId = (opts.uploadId as string) || `eval-${runId}`;

// Build all 4 models × 2 prompts = 8 configs
const configs: TrialConfig[] = [];
for (const m of MODELS) {
  for (const prompt of prompts) {
    configs.push({
      project,
      agent: m.agent,
      model: m.id,
      effort: effortForModel(m.id, "high"),
      prompt,
    });
  }
}

log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
log(`${configs.length} parallel runs: ${MODELS.map((m) => m.label).join(", ")} × ${prompts.join(", ")}`);
log(`Run: ${runId}\n`);

// Run all in parallel
const settled = await Promise.allSettled(
  configs.map((c) => {
    const tag = `${c.model.replace("claude-", "")}+${c.prompt}`;
    return runTask(c, runId, uploadId, createLogger(tag));
  }),
);

const results: TrialResult[] = [];
for (let i = 0; i < settled.length; i++) {
  const s = settled[i]!;
  if (s.status === "fulfilled") {
    results.push(s.value);
  } else {
    const c = configs[i]!;
    log(pc.red(`\n✗ ${c.model} + ${c.prompt}: ${s.reason}`));
  }
}

// Summary table sorted by ghost stories rate
if (results.length > 0) {
  results.sort((a, b) => {
    const ga = a.grading.ghostStories?.successRate ?? -1;
    const gb = b.grading.ghostStories?.successRate ?? -1;
    return gb - ga;
  });

  log(pc.bold("\n\nResults (sorted by ghost stories rate)"));
  log("=".repeat(110));
  log(
    ["Model", "Prompt", "Build", "Ghost", "TS Err", "Cost", "Time", "Turns"]
      .map((h, i) => h.padEnd(i === 0 ? 22 : i === 1 ? 12 : 10))
      .join(" | "),
  );
  log("-".repeat(110));

  for (const r of results) {
    const build = r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL");
    const ghost = r.grading.ghostStories;
    const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";
    log(
      [
        r.model.padEnd(22),
        r.prompt.padEnd(12),
        (r.grading.buildSuccess ? "PASS" : "FAIL").padEnd(10).replace(/PASS|FAIL/, build),
        ghostStr.padEnd(10),
        String(r.grading.typeCheckErrors).padEnd(10),
        formatCost(r.execution.cost).padEnd(10),
        formatDuration(r.execution.duration).padEnd(10),
        String(r.execution.turns).padEnd(10),
      ].join(" | "),
    );
  }

  log("-".repeat(110));
  const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
  const ghostRates = results.map((r) => r.grading.ghostStories?.successRate).filter((r) => r != null);
  const avgGhost = ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

  log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
  log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

log("\nDone.");
