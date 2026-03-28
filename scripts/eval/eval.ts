/**
 * Eval harness entry point — single or parallel trial runs.
 *
 * Runs with `node ./eval/eval.ts` (no jiti). Node 22+ supports .ts natively
 * via type stripping. Import specifiers use explicit .ts extensions.
 *
 * Usage:
 *   node eval/eval.ts -p mealdrop                         # single run (claude, default model)
 *   node eval/eval.ts -p mealdrop -m gpt-5.4              # single run (agent inferred from model)
 *   node eval/eval.ts -p mealdrop -m sonnet-4.6,gpt-5.4   # parallel runs
 *   node eval/eval.ts -p mealdrop -a claude,codex          # parallel runs (default model each)
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import pc from "picocolors";
import type { AgentName, TrialConfig, TrialResult } from "./types.ts";
import { AGENTS, PROJECTS } from "./config.ts";
import { runTask } from "./lib/run-task.ts";
import { createLogger, formatDuration, formatCost, formatTable, listPrompts } from "./lib/utils.ts";

const logger = createLogger();

const { values: opts } = parseArgs({
  options: {
    project: { type: "string", short: "p" },
    agent: { type: "string", short: "a" },
    model: { type: "string", short: "m" },
    effort: { type: "string", short: "e" },
    prompt: { type: "string" },
    verbose: { type: "boolean", short: "v", default: false },
    "list-projects": { type: "boolean", default: false },
    "list-models": { type: "boolean", default: false },
    "list-prompts": { type: "boolean", default: false },
  },
});

// --- List commands ---

if (opts["list-projects"]) {
  for (const p of PROJECTS) logger.log(`  ${pc.bold(p.name)} — ${p.description}`);
  process.exit(0);
}
if (opts["list-models"]) {
  for (const [agent, { models }] of Object.entries(AGENTS)) {
    logger.log(`\n  ${pc.bold(agent)}`);
    for (const m of models) logger.log(`    ${m}`);
  }
  process.exit(0);
}
if (opts["list-prompts"]) {
  for (const name of listPrompts()) logger.log(`  ${pc.bold(name)}`);
  process.exit(0);
}

// --- Validate project ---

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  logger.log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

// --- Build configs (supports comma-separated values for parallel runs) ---

const promptNames = opts.prompt?.split(",") ?? ["setup"];
const allModels = Object.values(AGENTS).flatMap((cfg) => cfg.models);

// Determine agent → model pairs
let agentModels: Array<{ agent: AgentName; model: string }>;

if (opts.model) {
  // Models specified — infer agent per model
  agentModels = opts.model.split(",").map((model) => {
    const entry = Object.entries(AGENTS).find(([, cfg]) => cfg.models.includes(model));
    if (!entry) {
      logger.log(pc.red(`Unknown model: ${model}. Available: ${allModels.join(", ")}`));
      process.exit(1);
    }
    return { agent: entry[0] as AgentName, model };
  });
  // If --agent is also specified, filter to matching agents
  if (opts.agent) {
    const filter = opts.agent.split(",");
    agentModels = agentModels.filter((am) => filter.includes(am.agent));
  }
} else if (opts.agent) {
  // Agents specified — use default model per agent
  agentModels = opts.agent.split(",").map((name) => {
    const cfg = AGENTS[name as AgentName];
    if (!cfg) {
      logger.log(pc.red(`Unknown agent: ${name}. Options: ${Object.keys(AGENTS).join(", ")}`));
      process.exit(1);
    }
    return { agent: name as AgentName, model: cfg.defaultModel };
  });
} else {
  // Default: single claude run
  agentModels = [{ agent: "claude", model: AGENTS.claude.defaultModel }];
}

// Expand to full configs: agent×model × prompt
const configs = agentModels.flatMap(({ agent, model }) => {
  const cfg = AGENTS[agent];
  const effort = opts.effort ?? cfg.defaultEffort;
  if (!cfg.efforts.includes(effort)) {
    logger.log(pc.red(`Unknown effort "${effort}" for ${agent}. Available: ${cfg.efforts.join(", ")}`));
    process.exit(1);
  }
  return promptNames.map((prompt) => ({
    config: { project, agent, model, effort, prompt, verbose: opts.verbose } as TrialConfig,
    label: `${model}+${prompt}`,
  }));
});

if (configs.length === 0) {
  logger.log(pc.red("No matching agent/model/prompt combinations found."));
  process.exit(1);
}

// --- Print header ---

const runId = randomUUID().slice(0, 8);
logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
if (configs.length === 1) {
  const { agent, model, effort, prompt } = configs[0].config;
  logger.log(`Agent: ${agent} | Model: ${model} | Effort: ${effort} | Prompt: ${prompt}`);
} else {
  logger.log(`${configs.length} parallel runs`);
  for (const [agent, { models }] of Object.entries(AGENTS)) {
    const active = models.filter((m) => configs.some((c) => c.config.model === m));
    if (active.length > 0) logger.log(`  ${agent}: ${active.join(", ")}`);
  }
  logger.log(`  prompts: ${[...new Set(promptNames)].join(", ")}`);
}
logger.log(`Run: ${runId}\n`);

// --- Execute (always use allSettled — works for 1 or N runs) ---

const settled = await Promise.allSettled(
  configs.map((c) => runTask(c.config, createLogger(configs.length > 1 ? c.label : undefined))),
);

const results: TrialResult[] = [];
for (const [i, s] of settled.entries()) {
  if (s.status === "fulfilled") {
    results.push(s.value);
  } else {
    logger.logError(`${configs[i].label}: ${s.reason instanceof Error ? s.reason.message : s.reason}`);
  }
}

if (results.length === 0) {
  process.exit(1);
}

// --- Print results ---

if (results.length === 1) {
  const r = results[0];
  const ghost = r.grading.ghostStories;
  const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";

  logger.log(pc.bold("\nResult"));
  logger.log(`  Build:   ${r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL")}`);
  logger.log(`  Ghost:   ${ghostStr}`);
  logger.log(`  TS Err:  ${r.grading.typeCheckErrors}`);
  logger.log(`  Score:   ${r.quality.score}`);
  logger.log(`  Cost:    ${formatCost(r.execution.cost)}`);
  logger.log(`  Time:    ${formatDuration(r.execution.duration)}`);
  logger.log(`  Turns:   ${r.execution.turns}`);
} else {
  results.sort((a, b) => (b.grading.ghostStories?.successRate ?? -1) - (a.grading.ghostStories?.successRate ?? -1));

  const headers = ["Agent", "Model", "Prompt", "Build", "Ghost", "TS Err", "Score", "Cost", "Time", "Turns"];
  const rows = results.map((r) => {
    const ghost = r.grading.ghostStories;
    const ghostStr = ghost ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)` : "-";
    return [
      r.agent,
      r.model,
      r.prompt,
      r.grading.buildSuccess ? pc.green("PASS") : pc.red("FAIL"),
      ghostStr,
      String(r.grading.typeCheckErrors),
      String(r.quality.score),
      formatCost(r.execution.cost),
      formatDuration(r.execution.duration),
      String(r.execution.turns),
    ];
  });

  logger.log(pc.bold("\n\nResults (sorted by ghost stories rate)"));
  logger.log(formatTable(headers, rows));

  const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
  const ghostRates = results.map((r) => r.grading.ghostStories?.successRate).filter((r): r is number => r != null);
  const avgGhost = ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

  logger.log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
  logger.log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

logger.log("\nDone.");
