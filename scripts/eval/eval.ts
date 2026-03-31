/**
 * Eval harness entry point.
 *
 * Runs with `node ./eval/eval.ts` (no jiti). Node 22+ supports .ts natively
 * via type stripping. Import specifiers use explicit .ts extensions.
 *
 * Usage:
 *   node eval/eval.ts -p mealdrop                       # claude defaults
 *   node eval/eval.ts -p mealdrop -a codex              # codex defaults
 *   node eval/eval.ts -p mealdrop -m gpt-5.4            # codex (inferred)
 *   node eval/eval.ts -p mealdrop -a claude -e max      # claude with max effort
 *   node eval/eval.ts -p mealdrop --manual          # prepare only, print instructions
 *   node eval/eval.ts --list-projects
 *   node eval/eval.ts --list-models
 *   node eval/eval.ts --list-prompts
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import pc from 'picocolors';
import {
  AGENT_IDS,
  AGENTS,
  CLAUDE_MODELS,
  CLAUDE_EFFORTS,
  CODEX_MODELS,
  CODEX_EFFORTS,
  resolveClaudeSdkModel,
  type AgentId,
  type AgentVariant,
} from './lib/agents/config.ts';
import { PROJECTS } from './lib/projects.ts';
import { runTrial, type TrialConfig } from './lib/run-trial.ts';
import { prepareTrial } from './lib/prepare-trial.ts';
import {
  createLogger,
  formatDuration,
  formatCost,
  listPrompts,
  loadPrompt,
  generateTrialId,
  captureEnvironment,
} from './lib/utils.ts';

const PROJECT_NAMES = PROJECTS.map((p) => p.name) as [string, ...string[]];
const LIST_MODE_FLAGS = [
  ['listProjects', 'list-projects'],
  ['listModels', 'list-models'],
  ['listPrompts', 'list-prompts'],
] as const;
type ListMode = (typeof LIST_MODE_FLAGS)[number][0];
const LIST_MODE_NAMES = LIST_MODE_FLAGS.map(([name]) => name) as [
  ListMode,
  ...ListMode[],
];

const runArgsBase = {
  kind: z.literal('run'),
  project: z.enum(PROJECT_NAMES),
  prompt: z.string().default('setup'),
  verbose: z.boolean().default(false),
  manual: z.boolean().default(false),
};

const listArgsSchema = z.object({
  kind: z.literal('list'),
  listMode: z.enum(LIST_MODE_NAMES),
});

const claudeRunArgsSchema = z.object({
  ...runArgsBase,
  agent: z.literal('claude'),
  model: z.enum(CLAUDE_MODELS).default(AGENTS.claude.defaultModel),
  effort: z.enum(CLAUDE_EFFORTS).default(AGENTS.claude.defaultEffort),
});

const codexRunArgsSchema = z.object({
  ...runArgsBase,
  agent: z.literal('codex'),
  model: z.enum(CODEX_MODELS).default(AGENTS.codex.defaultModel),
  effort: z.enum(CODEX_EFFORTS).default(AGENTS.codex.defaultEffort),
});

type RunArgs = z.infer<typeof claudeRunArgsSchema> | z.infer<typeof codexRunArgsSchema>;

const cliArgsSchema = z.discriminatedUnion('kind', [
  listArgsSchema,
  claudeRunArgsSchema,
  codexRunArgsSchema,
]);

const { values } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    agent: { type: 'string', short: 'a' },
    model: { type: 'string', short: 'm' },
    effort: { type: 'string', short: 'e' },
    prompt: { type: 'string' },
    verbose: { type: 'boolean', short: 'v' },
    manual: { type: 'boolean' },
    'list-projects': { type: 'boolean' },
    'list-models': { type: 'boolean' },
    'list-prompts': { type: 'boolean' },
  },
  args: process.argv.slice(2),
  strict: true,
});

const cliInput = resolveCliInput(values);
if ('error' in cliInput) {
  console.error(pc.red(`  ${cliInput.error}`));
  process.exit(1);
}

const parsed = cliArgsSchema.safeParse(cliInput);

if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(pc.red(`  ${issue.path.join('.')}: ${issue.message}`));
  }
  process.exit(1);
}

const args = parsed.data;
const logger = createLogger();

if (args.kind === 'list') {
  runListMode(args.listMode, logger);
  process.exit(0);
}

const runArgs: RunArgs = args;
const project = PROJECTS.find((p) => p.name === args.project)!;
const variant = toVariant(runArgs);

logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
logger.log(
  `Agent: ${variant.agent} | Model: ${variant.model} | Effort: ${variant.effort} | Prompt: ${runArgs.prompt}\n`
);

if (runArgs.manual) {
  const trialId = generateTrialId(project.name, variant.agent, variant.model, runArgs.prompt);
  const workspace = await prepareTrial(project, trialId, logger);
  await captureEnvironment(workspace.resultsDir);

  const prompt = loadPrompt(runArgs.prompt);
  const promptPath = join(workspace.resultsDir, 'prompt.md');
  await writeFile(promptPath, prompt);

  const cliCommand = buildManualCommand(variant, promptPath);

  logger.log(pc.bold('\n── Manual mode ──'));
  logger.log(`\n  Trial dir:    ${pc.cyan(workspace.trialDir)}`);
  logger.log(`  Project dir:  ${pc.cyan(workspace.projectPath)}`);
  logger.log(`  Prompt file:  ${pc.cyan(promptPath)}`);
  logger.log(pc.bold('\nRun the agent yourself:\n'));
  logger.log(`  ${pc.green('cd')} ${workspace.projectPath}`);
  logger.log(`  ${pc.green(cliCommand)}\n`);
} else {
  const result = await runTrial(
    { project, variant, prompt: runArgs.prompt, verbose: runArgs.verbose } satisfies TrialConfig,
    logger
  );

  const ghost = result.grade.ghostStories;
  const ghostStr = ghost
    ? `${ghost.passed}/${ghost.total} (${Math.round(ghost.successRate * 100)}%)`
    : '-';

  logger.log(pc.bold('\nResult'));
  logger.log(`  Build:   ${result.grade.buildSuccess ? pc.green('PASS') : pc.red('FAIL')}`);
  logger.log(`  Ghost:   ${ghostStr}`);
  logger.log(`  TS Err:  ${result.grade.typeCheckErrors}`);
  logger.log(`  Score:   ${result.score.score}`);
  logger.log(`  Cost:    ${formatCost(result.execution.cost)}`);
  logger.log(`  Time:    ${formatDuration(result.execution.duration)}`);
  logger.log(`  Turns:   ${result.execution.turns}`);

  logger.log('\nDone.');
}

function inferAgent(model: string): AgentId {
  for (const id of AGENT_IDS) {
    if (AGENTS[id].models.some((candidate) => candidate === model)) return id;
  }
  throw new Error(`No agent found for model: ${model}`);
}

function buildManualCommand(variant: AgentVariant, promptPath: string): string {
  const promptArg = `"$(cat ${promptPath})"`;
  if (variant.agent === 'claude') {
    return `claude --model ${resolveClaudeSdkModel(variant.model)} ${promptArg}`;
  }
  return `codex --model ${variant.model} --reasoning-effort ${variant.effort} ${promptArg}`;
}

function resolveCliInput(values: Record<string, string | boolean | undefined>) {
  const listModes = LIST_MODE_FLAGS.filter(([, flag]) => values[flag]).map(([name]) => name);
  if (listModes.length > 1) {
    return {
      error: `Choose only one list mode at a time: ${listModes.join(', ')}`,
    } as const;
  }
  if (listModes.length === 1) {
    return {
      kind: 'list',
      listMode: listModes[0],
    } as const;
  }

  const agent: AgentId =
    values.agent === 'claude' || values.agent === 'codex'
      ? values.agent
      : values.model
        ? inferAgent(values.model as string)
        : 'claude';

  return {
    kind: 'run',
    ...values,
    agent,
  } as const;
}

function runListMode(listMode: ListMode, logger: ReturnType<typeof createLogger>) {
  switch (listMode) {
    case 'listProjects':
      for (const p of PROJECTS) logger.log(`  ${pc.bold(p.name)} — ${p.description}`);
      break;
    case 'listModels':
      for (const [name, { models }] of Object.entries(AGENTS)) {
        logger.log(`\n  ${pc.bold(name)}`);
        for (const model of models) logger.log(`    ${model}`);
      }
      break;
    case 'listPrompts':
      for (const name of listPrompts()) logger.log(`  ${pc.bold(name)}`);
      break;
  }
}

function toVariant(args: RunArgs): AgentVariant {
  return args.agent === 'claude'
    ? { agent: 'claude', model: args.model, effort: args.effort }
    : { agent: 'codex', model: args.model, effort: args.effort };
}
