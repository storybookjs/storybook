import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import pc from "picocolors";
import type { TrialConfig, AgentName, Effort } from "./types.ts";
import { AGENTS, PROJECTS } from "./types.ts";
import { runTask } from "./lib/run-task.ts";
import { log, formatDuration, formatCost, listPrompts } from "./lib/utils.ts";

/** Sentinel for structured IPC with eval-parallel.ts. */
export const RESULT_SENTINEL = "__EVAL_RESULT_d3f1a8b2__";

const { values: opts } = parseArgs({
  options: {
    project: { type: "string", short: "p" },
    agent: { type: "string", short: "a", default: "claude" },
    model: { type: "string", short: "m" },
    effort: { type: "string", short: "e", default: "high" },
    prompt: { type: "string", default: "setup" },
    verbose: { type: "boolean", short: "v", default: false },
    "upload-id": { type: "string", short: "u" },
    "list-projects": { type: "boolean", default: false },
    "list-models": { type: "boolean", default: false },
    "list-prompts": { type: "boolean", default: false },
  },
});

if (opts["list-projects"]) {
  for (const p of PROJECTS) log(`  ${pc.bold(p.name)} — ${p.description}`);
  process.exit(0);
}
if (opts["list-models"]) {
  for (const [agent, { models }] of Object.entries(AGENTS)) {
    log(`\n  ${pc.bold(agent)}`);
    for (const m of models) log(`    ${m}`);
  }
  process.exit(0);
}
if (opts["list-prompts"]) {
  for (const name of listPrompts()) log(`  ${pc.bold(name)}`);
  process.exit(0);
}

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

// Infer agent from model if model is specified, otherwise use --agent flag
let agent: AgentName;
let model: string;

if (opts.model) {
  const match = Object.entries(AGENTS).find(([, cfg]) => cfg.models.includes(opts.model as string));
  if (!match) {
    const all = Object.values(AGENTS).flatMap((cfg) => cfg.models);
    log(pc.red(`Unknown model: ${opts.model}. Available: ${all.join(", ")}`));
    process.exit(1);
  }
  agent = match[0] as AgentName;
  model = opts.model as string;
} else {
  agent = opts.agent as AgentName;
  const agentConfig = AGENTS[agent];
  if (!agentConfig) {
    log(pc.red(`Unknown agent: ${agent}. Options: ${Object.keys(AGENTS).join(", ")}`));
    process.exit(1);
  }
  model = agentConfig.defaultModel;
}

const effort = opts.effort as Effort;
const runId = randomUUID().slice(0, 8);
const uploadId = opts["upload-id"] || `eval-${runId}`;

const config: TrialConfig = {
  project,
  agent,
  model,
  effort,
  prompt: opts.prompt as string,
  verbose: opts.verbose,
};

log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
log(`Agent: ${agent} | Model: ${model} | Effort: ${effort} | Prompt: ${config.prompt}`);
log(`Run: ${runId}\n`);

try {
  const result = await runTask(config, runId, uploadId);
  const ghost = result.grading.ghostStories;
  const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";

  log(pc.bold("\nResult"));
  log(`  Build:   ${result.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL")}`);
  log(`  Ghost:   ${ghostStr}`);
  log(`  TS Err:  ${result.grading.typeCheckErrors}`);
  log(`  Score:   ${result.quality.score}`);
  log(`  Cost:    ${formatCost(result.execution.cost)}`);
  log(`  Time:    ${formatDuration(result.execution.duration)}`);
  log(`  Turns:   ${result.execution.turns}`);

  console.log(`${RESULT_SENTINEL}${JSON.stringify(result)}`);
} catch (error) {
  log(pc.red(`\nFailed: ${error instanceof Error ? error.message : error}`));
  process.exit(1);
}
