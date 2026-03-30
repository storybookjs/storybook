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
 *   node eval/eval.ts --list-projects
 *   node eval/eval.ts --list-models
 *   node eval/eval.ts --list-prompts
 */
import { parseArgs } from 'node:util';
import { z } from 'zod';
import pc from 'picocolors';
import {
  AGENT_IDS,
  CLAUDE_MODELS,
  CLAUDE_EFFORTS,
  CODEX_MODELS,
  CODEX_EFFORTS,
  type AgentId,
  type AgentVariant,
  type TrialConfig,
} from './types.ts';
import { AGENTS, PROJECTS } from './config.ts';
import { runTrial } from './lib/run-trial.ts';
import { createLogger, formatDuration, formatCost, listPrompts } from './lib/utils.ts';

// --- Helpers ---

const PROJECT_NAMES = PROJECTS.map((p) => p.name) as [string, ...string[]];

function inferAgent(model: string): AgentId {
  for (const id of AGENT_IDS) {
    if (AGENTS[id].models.includes(model)) return id;
  }
  throw new Error(`No agent found for model: ${model}`);
}

// --- CLI schema: base options + discriminated union on agent ---

const base = {
  project: z.enum(PROJECT_NAMES).optional(),
  prompt: z.string().default('setup'),
  verbose: z.boolean().default(false),
  listProjects: z.boolean().default(false),
  listModels: z.boolean().default(false),
  listPrompts: z.boolean().default(false),
};

const argsSchema = z.discriminatedUnion('agent', [
  z.object({
    ...base,
    agent: z.literal('claude'),
    model: z.enum(CLAUDE_MODELS).default('sonnet-4.6'),
    effort: z.enum(CLAUDE_EFFORTS).default('high'),
  }),
  z.object({
    ...base,
    agent: z.literal('codex'),
    model: z.enum(CODEX_MODELS).default('gpt-5.4'),
    effort: z.enum(CODEX_EFFORTS).default('high'),
  }),
]);

// --- Parse CLI ---

const { values } = parseArgs({
  options: {
    project: { type: 'string', short: 'p' },
    agent: { type: 'string', short: 'a' },
    model: { type: 'string', short: 'm' },
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

// --- List commands ---

if (args.listProjects) {
  for (const p of PROJECTS) logger.log(`  ${pc.bold(p.name)} — ${p.description}`);
  process.exit(0);
}
if (args.listModels) {
  for (const [name, { models }] of Object.entries(AGENTS)) {
    logger.log(`\n  ${pc.bold(name)}`);
    for (const m of models) logger.log(`    ${m}`);
  }
  process.exit(0);
}
if (args.listPrompts) {
  for (const name of listPrompts()) logger.log(`  ${pc.bold(name)}`);
  process.exit(0);
}

// --- Validate project ---

if (!args.project) {
  logger.log(pc.red(`Specify a project with -p. Available: ${PROJECT_NAMES.join(', ')}`));
  process.exit(1);
}
const project = PROJECTS.find((p) => p.name === args.project)!;

// --- Run trial ---

const variant: AgentVariant =
  args.agent === 'claude'
    ? { agent: args.agent, model: args.model, effort: args.effort }
    : { agent: args.agent, model: args.model, effort: args.effort };

logger.log(pc.bold(`\nStorybook Setup Eval — ${project.name}`));
logger.log(
  `Agent: ${variant.agent} | Model: ${variant.model} | Effort: ${variant.effort} | Prompt: ${args.prompt}\n`
);

const result = await runTrial(
  { project, variant, prompt: args.prompt, verbose: args.verbose } satisfies TrialConfig,
  logger
);

// --- Print result ---

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
