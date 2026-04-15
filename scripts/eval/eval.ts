/**
 * Eval harness entry point.
 *
 * Runs with `node scripts/eval/eval.ts` (no jiti). Node 22+ supports .ts natively
 * via type stripping. Import specifiers use explicit .ts extensions.
 *
 * Usage:
 *   node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play   # claude defaults
 *   node scripts/eval/eval.ts -p mealdrop --prompt setup -a codex      # codex defaults
 *   node scripts/eval/eval.ts -p mealdrop --prompt setup -m gpt-5.4    # codex (inferred)
 *   node scripts/eval/eval.ts -p mealdrop --prompt setup -a claude -e max
 *   node scripts/eval/eval.ts -p mealdrop --prompt setup --manual      # prepare only, print instructions
 *   node scripts/eval/eval.ts --list-projects
 *   node scripts/eval/eval.ts --list-models
 *   node scripts/eval/eval.ts --list-prompts
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import pc from 'picocolors';
import {
  AGENT_IDS,
  AGENTS,
  CLAUDE_EFFORTS,
  CLAUDE_MODELS,
  CODEX_EFFORTS,
  CODEX_MODELS,
  type AgentId,
  type AgentVariant,
} from './lib/agents/config.ts';
import { prepareTrial } from './lib/prepare-trial.ts';
import { PROJECTS } from './lib/projects.ts';
import { runTrial, type TrialConfig } from './lib/run-trial.ts';
import {
  captureEnvironment,
  createLogger,
  formatCost,
  formatDuration,
  formatHelp,
  formatScorePercent,
  generateTrialId,
  listPrompts,
  loadPrompt,
  EXAMPLE_PROMPT_BASENAME,
  NODE_EVAL_TRIAL_SCRIPT,
} from './lib/utils.ts';

const PROJECT_NAMES = PROJECTS.map((p) => p.name) as [string, ...string[]];

const base = {
  project: z.enum(PROJECT_NAMES).optional(),
  prompt: z.string().optional(),
  verbose: z.boolean().default(false),
  manual: z.boolean().default(false),
  listProjects: z.boolean().default(false),
  listModels: z.boolean().default(false),
  listPrompts: z.boolean().default(false),
};

// `parseArgs` cannot require `--prompt` only when `-p` is used; Zod `superRefine` applies that rule after parse.
const argsSchema = z
  .discriminatedUnion('agent', [
    z.object({
      ...base,
      agent: z.literal('claude'),
      model: z.enum(CLAUDE_MODELS).default(AGENTS.claude.defaultModel),
      effort: z.enum(CLAUDE_EFFORTS).default(AGENTS.claude.defaultEffort),
    }),
    z.object({
      ...base,
      agent: z.literal('codex'),
      model: z.enum(CODEX_MODELS).default(AGENTS.codex.defaultModel),
      effort: z.enum(CODEX_EFFORTS).default(AGENTS.codex.defaultEffort),
    }),
  ])
  .superRefine((data, ctx) => {
    const needsPromptForTrial =
      data.project != null &&
      !data.listProjects &&
      !data.listModels &&
      !data.listPrompts;
    if (!needsPromptForTrial) {
      return;
    }
    const prompt = data.prompt?.trim() ?? '';
    if (prompt === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Specify --prompt <name> (markdown file in scripts/eval/prompts/). Example: --prompt ${EXAMPLE_PROMPT_BASENAME}. Run with --list-prompts to see available names.`,
        path: ['prompt'],
      });
    }
  });

const evalOptions = {
  project: { type: 'string' as const, short: 'p', description: 'Project to evaluate' },
  agent: { type: 'string' as const, short: 'a', description: 'Agent to use (claude or codex)' },
  model: {
    type: 'string' as const,
    short: 'm',
    description: 'Model to use (agent inferred if omitted)',
  },
  effort: { type: 'string' as const, short: 'e', description: 'Effort level' },
  prompt: {
    type: 'string' as const,
    description: `Prompt template name — required with -p (file: prompts/{name}.md; e.g. ${EXAMPLE_PROMPT_BASENAME})`,
  },
  verbose: { type: 'boolean' as const, short: 'v', description: 'Enable verbose output' },
  manual: {
    type: 'boolean' as const,
    description: 'Prepare workspace only, print instructions',
  },
  'list-projects': { type: 'boolean' as const, description: 'List available projects' },
  'list-models': { type: 'boolean' as const, description: 'List available models' },
  'list-prompts': { type: 'boolean' as const, description: 'List available prompts' },
  help: { type: 'boolean' as const, short: 'h', description: 'Show this help and exit' },
};

const { values } = parseArgs({
  options: evalOptions,
  args: process.argv.slice(2),
  strict: true,
});

if (values.help) {
  console.log(
    formatHelp(
      `node ${NODE_EVAL_TRIAL_SCRIPT} [options]`,
      'Run a single eval trial against a benchmark project.',
      evalOptions
    )
  );
  process.exit(0);
}

// Resolve the discriminator: explicit --agent, inferred from --model, or default to claude.
const agent = values.agent ?? (values.model ? inferAgent(values.model) : 'claude');

const parsed = argsSchema.safeParse({
  ...values,
  agent,
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

if (args.listProjects) {
  for (const project of PROJECTS) {
    logger.log(`  ${pc.bold(project.name)} — ${project.description}`);
  }
  process.exit(0);
}
if (args.listModels) {
  for (const [name, { models }] of Object.entries(AGENTS)) {
    logger.log(`\n  ${pc.bold(name)}`);
    for (const model of models) logger.log(`    ${model}`);
  }
  process.exit(0);
}
if (args.listPrompts) {
  for (const name of listPrompts()) logger.log(`  ${pc.bold(name)}`);
  process.exit(0);
}

if (!args.project) {
  logger.log(pc.red(`Specify a project with -p. Available: ${PROJECT_NAMES.join(', ')}`));
  process.exit(1);
}
const project = PROJECTS.find((p) => p.name === args.project)!;
const variant = toVariant(args);
const promptName = args.prompt!.trim();

logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
logger.log(
  `Agent: ${variant.agent} | Model: ${variant.model} | Effort: ${variant.effort} | Prompt: ${promptName}\n`
);

if (args.manual) {
  const trialId = generateTrialId();
  const workspace = await prepareTrial(project, trialId, logger);
  await captureEnvironment();

  const prompt = loadPrompt(promptName);
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
    {
      project,
      variant,
      prompt: promptName,
      verbose: args.verbose,
    } satisfies TrialConfig,
    logger
  );

  const storyRenderStr = formatPassedTotalSummary(
    result.grade.baselinePreviewStories,
    result.grade.storyRender
  );
  const ghostStoriesStr = formatPassedTotalSummary(
    result.grade.baselineGhostStories,
    result.grade.ghostStories
  );
  logger.log(pc.bold('\nResult'));
  logger.log(`  Build:   ${result.grade.buildSuccess ? pc.green('PASS') : pc.red('FAIL')}`);
  logger.log(`  Stories: ${storyRenderStr}`);
  logger.log(`  Ghost:   ${ghostStoriesStr}`);
  logger.log(`  TS Err:  ${result.grade.typeCheckErrors}`);
  logger.log(`  Score:   ${formatScorePercent(result.score.score)} (normalized preview gain)`);
  logger.log(`  Cost:    ${formatCost(result.execution.cost)}`);
  logger.log(`  Time:    ${formatDuration(result.execution.duration)}`);
  logger.log(`  Turns:   ${result.execution.turns}`);
  logger.log(`  PR:      ${result.publish.url}`);

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
    const sdkModel = AGENTS.claude.sdkModelIds[variant.model] ?? variant.model;
    return `claude --model ${sdkModel} ${promptArg}`;
  }
  return `codex --model ${variant.model} --reasoning-effort ${variant.effort} ${promptArg}`;
}

function toVariant(args: z.infer<typeof argsSchema>): AgentVariant {
  return args.agent === 'claude'
    ? { agent: 'claude', model: args.model, effort: args.effort }
    : { agent: 'codex', model: args.model, effort: args.effort };
}

function formatPassedTotalSummary(
  before?: { passed: number; total: number },
  after?: { passed: number; total: number }
) {
  const beforeSummary = formatPassedTotal(before);
  const afterSummary = formatPassedTotal(after);

  if (beforeSummary === '-' && afterSummary === '-') {
    return '-';
  }

  return `${beforeSummary} -> ${afterSummary}`;
}

function formatPassedTotal(summary?: { passed: number; total: number }) {
  if (!summary) {
    return '-';
  }

  const rate = summary.total > 0 ? summary.passed / summary.total : 0;
  return `${summary.passed}/${summary.total} (${Math.round(rate * 100)}%)`;
}
