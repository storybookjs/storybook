import { randomUUID } from "node:crypto";
import { Command } from "commander";
import pc from "picocolors";
import type { TrialConfig, AgentName, Effort } from "./types.ts";
import { AGENTS } from "./types.ts";
import { PROJECTS } from "./config.ts";
import { runTask } from "./lib/run-task.ts";
import { listPrompts } from "./lib/generate-prompt.ts";
import { log, formatDuration, formatCost } from "./lib/utils.ts";

const program = new Command()
  .name("eval")
  .description("Run a single Storybook setup eval")
  .option("-p, --project <name>", "project to evaluate")
  .option("-a, --agent <name>", "agent: claude-code, codex", "claude-code")
  .option("-m, --model <name>", "model (default: per agent)")
  .option("-e, --effort <level>", "effort: low, medium, high, max", "high")
  .option("--prompt <name>", "prompt name", "setup")
  .option("-v, --verbose", "verbose output")
  .option("-u, --upload-id <id>", "upload ID for Google Sheets")
  .option("--list-projects", "list projects")
  .option("--list-models", "list models")
  .option("--list-prompts", "list prompts");

program.parse();
const opts = program.opts();

if (opts.listProjects) {
  for (const p of PROJECTS) log(`  ${pc.bold(p.name)} — ${p.description}`);
  process.exit(0);
}
if (opts.listModels) {
  for (const [agent, { models }] of Object.entries(AGENTS)) {
    log(`\n  ${pc.bold(agent)}`);
    for (const m of models) log(`    ${m}`);
  }
  process.exit(0);
}
if (opts.listPrompts) {
  for (const name of listPrompts()) log(`  ${pc.bold(name)}`);
  process.exit(0);
}

const project = PROJECTS.find((p) => p.name === opts.project);
if (!project) {
  log(pc.red(`Specify a project with -p. Available: ${PROJECTS.map((p) => p.name).join(", ")}`));
  process.exit(1);
}

const agent = opts.agent as AgentName;
const agentConfig = AGENTS[agent];
if (!agentConfig) {
  log(pc.red(`Unknown agent: ${agent}. Options: ${Object.keys(AGENTS).join(", ")}`));
  process.exit(1);
}

const model = (opts.model ?? agentConfig.defaultModel) as string;
if (!agentConfig.models.includes(model)) {
  log(pc.red(`Model ${model} not available for ${agent}. Options: ${agentConfig.models.join(", ")}`));
  process.exit(1);
}

const effort = opts.effort as Effort;
const runId = randomUUID().slice(0, 8);
const uploadId = (opts.uploadId as string) || `eval-${runId}`;

const config: TrialConfig = {
  project,
  agent,
  model,
  effort,
  prompt: opts.prompt as string,
  verbose: opts.verbose as boolean | undefined,
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
  log(`  Cost:    ${formatCost(result.execution.cost)}`);
  log(`  Time:    ${formatDuration(result.execution.duration)}`);
  log(`  Turns:   ${result.execution.turns}`);

  console.log(`__RESULT__${JSON.stringify(result)}`);
} catch (error) {
  log(pc.red(`\nFailed: ${error instanceof Error ? error.message : error}`));
  process.exit(1);
}
