/**
 * Eval harness entry point — single or parallel trial runs.
 *
 * Runs with `node ./eval/eval.ts` (no jiti). Node 22+ supports .ts natively
 * via type stripping. Import specifiers use explicit .ts extensions.
 *
 * Usage:
 *   node eval/eval.ts -p mealdrop                            # single run (claude, default model)
 *   node eval/eval.ts -p mealdrop -m gpt-5.4                 # single run (agent inferred from model)
 *   node eval/eval.ts -p mealdrop -m sonnet-4.6 -m gpt-5.4   # parallel runs
 *   node eval/eval.ts -p mealdrop -a claude -a codex          # parallel runs (default model each)
 *   node eval/eval.ts --list-projects                         # list projects
 *   node eval/eval.ts --list-models                           # list models
 *   node eval/eval.ts --list-prompts                          # list prompts
 */
import { parseArgs } from 'node:util';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import pc from 'picocolors';
import type { AgentId, TrialConfig, TrialReport } from './types.ts';
import { AGENTS, PROJECTS } from './config.ts';
import { runTrial } from './lib/run-trial.ts';
import { createLogger, formatDuration, formatCost, formatTable, listPrompts } from './lib/utils.ts';

// --- Derive valid options from config ---

const PROJECT_NAMES = PROJECTS.map((p) => p.name) as [string, ...string[]];
const AGENT_NAMES = Object.keys(AGENTS) as [string, ...string[]];
const ALL_MODELS = Object.values(AGENTS).flatMap((a) => a.models) as [string, ...string[]];
const ALL_EFFORTS = [...new Set(Object.values(AGENTS).flatMap((a) => a.efforts))] as [
  string,
  ...string[],
];

// --- Parse & validate CLI args ---

const argsSchema = z.object({
  project: z.enum(PROJECT_NAMES).optional(),
  agent: z.array(z.enum(AGENT_NAMES)).optional(),
  model: z.array(z.enum(ALL_MODELS)).optional(),
  effort: z.enum(ALL_EFFORTS).optional(),
  prompt: z.string().default('setup'),
  verbose: z.boolean().default(false),
  listProjects: z.boolean().default(false),
  listModels: z.boolean().default(false),
  listPrompts: z.boolean().default(false),
});

const { values } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    agent: { type: 'string', short: 'a', multiple: true },
    model: { type: 'string', short: 'm', multiple: true },
    effort: { type: 'string', short: 'e' },
    prompt: { type: 'string' },
    verbose: { type: 'boolean', short: 'v' },
    'list-projects': { type: 'boolean' },
    'list-models': { type: 'boolean' },
    'list-prompts': { type: 'boolean' },
  },
  args: process.argv.slice(2),
  strict: true,
});

const parsed = argsSchema.safeParse({
  ...values,
  listProjects: values['list-projects'],
  listModels: values['list-models'],
  listPrompts: values['list-prompts'],
});

if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(pc.red(`  ${issue.path.join('.')}: ${issue.message}`));
  }
  process.exit(1);
}

const args = parsed.data;
const logger = createLogger();

// --- List commands ---

if (args.listProjects) {
  for (const p of PROJECTS) logger.log(`  ${pc.bold(p.name)} — ${p.description}`);
  process.exit(0);
}
if (args.listModels) {
  for (const [agent, { models }] of Object.entries(AGENTS)) {
    logger.log(`\n  ${pc.bold(agent)}`);
    for (const m of models) logger.log(`    ${m}`);
  }
  process.exit(0);
}
if (args.listPrompts) {
  for (const name of listPrompts()) logger.log(`  ${pc.bold(name)}`);
  process.exit(0);
}

// --- Validate project (required when not listing) ---

if (!args.project) {
  logger.log(pc.red(`Specify a project with -p. Available: ${PROJECT_NAMES.join(', ')}`));
  process.exit(1);
}
const project = PROJECTS.find((p) => p.name === args.project)!;

// --- Build agent/model pairs (zod already validated individual values) ---

function inferAgent(model: string): AgentId {
  return Object.entries(AGENTS).find(([, cfg]) => cfg.models.includes(model))![0] as AgentId;
}

const agentModels: Array<{ agent: AgentId; model: string }> = args.model
  ? args.model
      .map((m) => ({ agent: inferAgent(m), model: m }))
      .filter((am) => !args.agent || args.agent.includes(am.agent))
  : args.agent
    ? args.agent.map((a) => ({ agent: a as AgentId, model: AGENTS[a as AgentId].defaultModel }))
    : [{ agent: 'claude', model: AGENTS.claude.defaultModel }];

const promptNames = args.prompt.split(',');
const configs = agentModels.flatMap(({ agent, model }) => {
  const effort = args.effort ?? AGENTS[agent].defaultEffort;
  return promptNames.map((prompt) => ({
    config: {
      project,
      variant: { agent, model, effort },
      prompt,
      verbose: args.verbose,
    } as TrialConfig,
    label: `${model}+${prompt}`,
  }));
});

// --- Print header ---

const runId = randomUUID().slice(0, 8);
logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
if (configs.length === 1) {
  const {
    variant: { agent, model, effort },
    prompt,
  } = configs[0].config;
  logger.log(`Agent: ${agent} | Model: ${model} | Effort: ${effort} | Prompt: ${prompt}`);
} else {
  logger.log(`${configs.length} parallel runs`);
  for (const [agent, { models }] of Object.entries(AGENTS)) {
    const active = models.filter((m) => configs.some((c) => c.config.variant.model === m));
    if (active.length > 0) logger.log(`  ${agent}: ${active.join(', ')}`);
  }
  logger.log(`  prompts: ${[...new Set(promptNames)].join(', ')}`);
}
logger.log(`Run: ${runId}\n`);

// --- Execute (always use allSettled — works for 1 or N runs) ---

const settled = await Promise.allSettled(
  configs.map((c) => runTrial(c.config, createLogger(configs.length > 1 ? c.label : undefined)))
);

const results: TrialReport[] = [];
for (const [i, s] of settled.entries()) {
  if (s.status === 'fulfilled') {
    results.push(s.value);
  } else {
    logger.logError(
      `${configs[i].label}: ${s.reason instanceof Error ? s.reason.message : s.reason}`
    );
  }
}

if (results.length === 0) {
  process.exit(1);
}

// --- Print results ---

if (results.length === 1) {
  const r = results[0];
  const ghost = r.grade.ghostStories;
  const ghostStr = ghost
    ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)`
    : '-';

  logger.log(pc.bold('\nResult'));
  logger.log(`  Build:   ${r.grade.buildSuccess ? pc.green('PASS') : pc.red('FAIL')}`);
  logger.log(`  Ghost:   ${ghostStr}`);
  logger.log(`  TS Err:  ${r.grade.typeCheckErrors}`);
  logger.log(`  Score:   ${r.score.score}`);
  logger.log(`  Cost:    ${formatCost(r.execution.cost)}`);
  logger.log(`  Time:    ${formatDuration(r.execution.duration)}`);
  logger.log(`  Turns:   ${r.execution.turns}`);
} else {
  results.sort(
    (a, b) => (b.grade.ghostStories?.successRate ?? -1) - (a.grade.ghostStories?.successRate ?? -1)
  );

  const headers = [
    'Agent',
    'Model',
    'Prompt',
    'Build',
    'Ghost',
    'TS Err',
    'Score',
    'Cost',
    'Time',
    'Turns',
  ];
  const rows = results.map((r) => {
    const ghost = r.grade.ghostStories;
    const ghostStr = ghost
      ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)`
      : '-';
    return [
      r.variant.agent,
      r.variant.model,
      r.prompt,
      r.grade.buildSuccess ? pc.green('PASS') : pc.red('FAIL'),
      ghostStr,
      String(r.grade.typeCheckErrors),
      String(r.score.score),
      formatCost(r.execution.cost),
      formatDuration(r.execution.duration),
      String(r.execution.turns),
    ];
  });

  logger.log(pc.bold('\n\nResults (sorted by ghost stories rate)'));
  logger.log(formatTable(headers, rows));

  const totalCost = results.reduce((s, r) => s + (r.execution.cost || 0), 0);
  const ghostRates = results
    .map((r) => r.grade.ghostStories?.successRate)
    .filter((r): r is number => r != null);
  const avgGhost =
    ghostRates.length > 0 ? ghostRates.reduce((s, r) => s + r, 0) / ghostRates.length : 0;

  logger.log(`\nGhost stories avg: ${pc.bold(`${Math.round(avgGhost * 100)}%`)}`);
  logger.log(`Total cost: ${pc.bold(formatCost(totalCost))}`);
}

logger.log('\nDone.');
