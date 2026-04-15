import { spawn as spawnChild, type SpawnOptions } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { parseArgs } from 'node:util';

import pLimit from 'p-limit';
import { z } from 'zod';

import { createInterface } from 'node:readline/promises';

import { esMain } from '../utils/esmain.ts';
import {
  AGENTS,
  CLAUDE_EFFORTS,
  CODEX_EFFORTS,
  type AgentVariant,
} from './lib/agents/config.ts';
import { PROJECTS } from './lib/projects.ts';
import {
  EVAL_ROOT,
  formatHelp,
  NODE_EVAL_RUN_BATCH_SCRIPT,
  NODE_EVAL_TRIAL_SCRIPT,
  REPO_ROOT,
} from './lib/utils.ts';

export const BATCH_EXCLUDED_PROJECT_NAMES = ['baklava'] as const;
export const BATCH_PROJECT_NAMES = PROJECTS.filter((project) => project.name !== 'baklava').map(
  (project) => project.name
);
export const BATCH_AGENT_IDS = ['claude', 'codex'] as const;
export const BATCH_DEFAULT_AGENT_IDS = ['claude', 'codex'] as const;
export const BATCH_DEFAULT_CLAUDE_EFFORTS = ['high'] as const;
export const BATCH_DEFAULT_EFFORTS = {
  codex: 'high',
} as const;
/** Default models for the batch matrix — single place to change (codex follows AGENTS). */
export const BATCH_MATRIX_MODELS = {
  claude: 'opus-4.6',
  codex: AGENTS.codex.defaultModel,
} as const satisfies Record<'claude' | 'codex', string>;

export const BATCH_VARIANTS = buildBatchVariants();
export const BATCH_REPETITIONS = 10;
export const BATCH_CONCURRENCY = 8;

export interface BatchRunDescriptor {
  project: (typeof BATCH_PROJECT_NAMES)[number];
  agent: AgentVariant['agent'];
  model: AgentVariant['model'];
  effort: AgentVariant['effort'];
  prompt: string;
  repetition: number;
  label: string;
  args: string[];
}

export interface BatchRunSummaryEntry extends BatchRunDescriptor {
  pid?: number;
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  status: 'success' | 'failed';
  logPath: string;
}

export interface BatchSummary {
  batchTimestamp: string;
  batchDir: string;
  logsDir: string;
  summaryPath: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  totalRuns: number;
  concurrency: number;
  succeeded: number;
  failed: number;
  runs: BatchRunSummaryEntry[];
}

export interface RunBatchOptions {
  descriptors?: BatchRunDescriptor[];
  concurrency?: number;
  repoRoot?: string;
  evalRoot?: string;
  batchTimestamp?: string;
  /** Required when `descriptors` are not provided — prompt template basename (prompts/{name}.md). */
  prompt?: string;
  /** Skip interactive confirmation (large API / token usage). */
  yes?: boolean;
  agents?: (typeof BATCH_AGENT_IDS)[number][];
  claudeEfforts?: (typeof CLAUDE_EFFORTS)[number][];
  claudeEffort?: (typeof CLAUDE_EFFORTS)[number];
  codexEffort?: (typeof CODEX_EFFORTS)[number];
  log?: (message: string) => void;
}

export interface SpawnedBatchChild {
  pid?: number;
  stdout?: Readable | null;
  stderr?: Readable | null;
  once(
    event: 'close',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): this;
  once(event: 'error', listener: (error: Error) => void): this;
}

export interface BatchRunnerDeps {
  now?: () => Date;
  spawn?: (command: string, args: string[], options: SpawnOptions) => SpawnedBatchChild;
}

export async function main(options: RunBatchOptions = {}, deps: BatchRunnerDeps = {}) {
  const summary = await runBatch(options, deps);
  return summary.failed > 0 ? 1 : 0;
}

export async function confirmBatchStart(runCount: number, options: { yes?: boolean } = {}) {
  if (options.yes) {
    return;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'This batch runs many trials and can consume substantial API quota. In non-interactive mode, pass --yes to confirm.'
    );
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (
      await rl.question(
        `This will launch ${runCount} eval trial(s) and may use significant API quota. Type "yes" to continue: `
      )
    ).trim();
    if (answer.toLowerCase() !== 'yes') {
      throw new Error('Batch aborted.');
    }
  } finally {
    rl.close();
  }
}

export async function runBatch(
  options: RunBatchOptions = {},
  deps: BatchRunnerDeps = {}
): Promise<BatchSummary> {
  const descriptors =
    options.descriptors ??
    buildBatchRunDescriptors({
      prompt: requireBatchPrompt(options),
      agents: options.agents,
      claudeEfforts: options.claudeEfforts,
      claudeEffort: options.claudeEffort,
      codexEffort: options.codexEffort,
    });

  if (!options.yes && options.descriptors === undefined) {
    await confirmBatchStart(descriptors.length, { yes: false });
  }

  const concurrency = options.concurrency ?? BATCH_CONCURRENCY;
  const repoRoot = resolve(options.repoRoot ?? REPO_ROOT);
  const evalRoot = resolve(options.evalRoot ?? EVAL_ROOT);
  const batchTimestamp = options.batchTimestamp ?? formatBatchTimestamp(deps.now?.() ?? new Date());
  const batchDir = join(evalRoot, 'batches', batchTimestamp);
  const logsDir = join(batchDir, 'logs');
  const summaryPath = join(batchDir, 'summary.json');
  const log = options.log ?? console.log;
  const now = deps.now ?? (() => new Date());
  const spawn = deps.spawn ?? defaultSpawn;

  await mkdir(logsDir, { recursive: true });

  const batchStart = now();
  const results: BatchRunSummaryEntry[] = new Array(descriptors.length);
  const limit = pLimit(concurrency);
  let started = 0;
  let finished = 0;

  log(
    `Starting eval batch ${batchTimestamp}: ${descriptors.length} runs, concurrency ${concurrency}, logs ${logsDir}`
  );

  await Promise.all(
    descriptors.map((descriptor, index) =>
      limit(async () => {
        started += 1;
        log(`[start ${started}/${descriptors.length}] ${descriptor.label}`);

        const result = await runBatchDescriptor(descriptor, {
          repoRoot,
          logsDir,
          now,
          spawn,
        });
        results[index] = result;

        finished += 1;
        log(
          `[finish ${finished}/${descriptors.length}] ${descriptor.label} ${result.status} ${formatExitResult(result)} ${result.durationMs}ms`
        );
      })
    )
  );

  const batchEnd = now();
  const summary: BatchSummary = {
    batchTimestamp,
    batchDir,
    logsDir,
    summaryPath,
    startedAt: batchStart.toISOString(),
    endedAt: batchEnd.toISOString(),
    durationMs: batchEnd.getTime() - batchStart.getTime(),
    totalRuns: results.length,
    concurrency,
    succeeded: results.filter((result) => result.status === 'success').length,
    failed: results.filter((result) => result.status === 'failed').length,
    runs: results,
  };

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  log(
    `Finished eval batch ${batchTimestamp}: ${summary.totalRuns} total, ${summary.succeeded} succeeded, ${summary.failed} failed`
  );

  return summary;
}

export function buildBatchVariants(
  options: {
    agents?: RunBatchOptions['agents'];
    claudeEfforts?: RunBatchOptions['claudeEfforts'];
    claudeEffort?: RunBatchOptions['claudeEffort'];
    codexEffort?: RunBatchOptions['codexEffort'];
  } = {}
): AgentVariant[] {
  const agents = resolveBatchAgents(options.agents);
  const claudeEfforts = resolveClaudeEfforts(options);
  const variants: AgentVariant[] = [];

  for (const agent of agents) {
    if (agent === 'claude') {
      for (const effort of claudeEfforts) {
        variants.push({
          agent: 'claude',
          model: BATCH_MATRIX_MODELS.claude,
          effort,
        });
      }
      continue;
    }

    variants.push({
      agent: 'codex',
      model: BATCH_MATRIX_MODELS.codex,
      effort: options.codexEffort ?? BATCH_DEFAULT_EFFORTS.codex,
    });
  }

  return variants;
}

export function buildBatchRunDescriptors(
  options: {
    prompt: string;
    agents?: RunBatchOptions['agents'];
    claudeEfforts?: RunBatchOptions['claudeEfforts'];
    claudeEffort?: RunBatchOptions['claudeEffort'];
    codexEffort?: RunBatchOptions['codexEffort'];
  }
): BatchRunDescriptor[] {
  const knownProjects = new Set(PROJECTS.map((project) => project.name));

  for (const project of BATCH_PROJECT_NAMES) {
    if (!knownProjects.has(project)) {
      throw new Error(`Configured batch project is missing from PROJECTS: ${project}`);
    }
  }

  const descriptors: BatchRunDescriptor[] = [];
  const variants =
    options.agents == null &&
    options.claudeEfforts == null &&
    options.claudeEffort == null &&
    options.codexEffort == null
      ? BATCH_VARIANTS
      : buildBatchVariants(options);

  for (let repetition = 1; repetition <= BATCH_REPETITIONS; repetition += 1) {
    for (const variant of variants) {
      for (const project of BATCH_PROJECT_NAMES) {
        descriptors.push(createBatchRunDescriptor(project, variant, repetition, options.prompt));
      }
    }
  }

  return descriptors;
}

function requireBatchPrompt(options: RunBatchOptions): string {
  if (options.prompt != null && options.prompt.trim() !== '') {
    return options.prompt.trim();
  }
  throw new Error(
    'runBatch: pass `prompt` (prompt template basename) or provide `descriptors` explicitly.'
  );
}

async function runBatchDescriptor(
  descriptor: BatchRunDescriptor,
  context: {
    repoRoot: string;
    logsDir: string;
    now: () => Date;
    spawn: NonNullable<BatchRunnerDeps['spawn']>;
  }
): Promise<BatchRunSummaryEntry> {
  const logPath = join(context.logsDir, `${descriptor.label}.log`);
  const logStream = createWriteStream(logPath);
  const start = context.now();
  let pid: number | undefined;
  let exitCode: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let spawnError: Error | undefined;

  logStream.write(`$ node ${descriptor.args.join(' ')}\n\n`);

  try {
    const stdio: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe'];
    const child = context.spawn('node', descriptor.args, {
      cwd: context.repoRoot,
      stdio,
    });

    pid = child.pid ?? undefined;
    child.stdout?.pipe(logStream, { end: false });
    child.stderr?.pipe(logStream, { end: false });

    const result = await waitForChild(child);
    exitCode = result.exitCode;
    signal = result.signal;
    spawnError = result.error;
  } catch (error) {
    spawnError = toError(error);
  }

  if (spawnError) {
    logStream.write(`\n[batch runner] ${formatError(spawnError)}\n`);
  }

  await closeLogStream(logStream);

  const end = context.now();

  return {
    ...descriptor,
    ...(pid == null ? {} : { pid }),
    startTimestamp: start.toISOString(),
    endTimestamp: end.toISOString(),
    durationMs: end.getTime() - start.getTime(),
    exitCode,
    signal,
    status: spawnError || exitCode !== 0 || signal !== null ? 'failed' : 'success',
    logPath,
  };
}

function createBatchRunDescriptor(
  project: BatchRunDescriptor['project'],
  variant: AgentVariant,
  repetition: number,
  prompt: string
): BatchRunDescriptor {
  const label = `${project}-${variant.agent}-${variant.model}-${variant.effort}-${prompt}-r${String(repetition).padStart(2, '0')}`;
  return {
    project,
    agent: variant.agent,
    model: variant.model,
    effort: variant.effort,
    prompt,
    repetition,
    label,
    args: [
      NODE_EVAL_TRIAL_SCRIPT,
      '-p',
      project,
      '-a',
      variant.agent,
      '-m',
      variant.model,
      '-e',
      variant.effort,
      '--prompt',
      prompt,
    ],
  };
}

function defaultSpawn(command: string, args: string[], options: SpawnOptions) {
  return spawnChild(command, args, options);
}

const runBatchArgsSchema = z.object({
  concurrency: z.coerce.number().int().positive().optional(),
  prompt: z.string().min(1),
  yes: z.boolean().optional(),
  agents: z.array(z.enum(BATCH_AGENT_IDS)).nonempty().optional(),
  claudeEfforts: z.array(z.enum(CLAUDE_EFFORTS)).nonempty().optional(),
  claudeEffort: z.enum(CLAUDE_EFFORTS).optional(),
  codexEffort: z.enum(CODEX_EFFORTS).optional(),
});

const runBatchOptions = {
  concurrency: { type: 'string' as const, description: 'Max concurrent runs (default: 8)' },
  prompt: {
    type: 'string' as const,
    description: 'Prompt template name (required; file: scripts/eval/prompts/{name}.md)',
  },
  agents: {
    type: 'string' as const,
    description: 'Comma-separated agent list (claude,codex)',
  },
  'claude-efforts': {
    type: 'string' as const,
    description: 'Comma-separated Claude effort levels',
  },
  'claude-effort': { type: 'string' as const, description: 'Single Claude effort level' },
  'codex-effort': { type: 'string' as const, description: 'Single Codex effort level' },
  yes: {
    type: 'boolean' as const,
    short: 'y',
    description: 'Skip the confirmation prompt (non-interactive / CI)',
  },
  help: { type: 'boolean' as const, short: 'h', description: 'Show this help and exit' },
};

export function parseRunBatchArgs(
  argv: string[]
):
  | Pick<
      RunBatchOptions,
      | 'agents'
      | 'claudeEfforts'
      | 'claudeEffort'
      | 'codexEffort'
      | 'concurrency'
      | 'prompt'
      | 'yes'
    >
  | { help: true } {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: runBatchOptions,
  });

  if (values.help) {
    return { help: true };
  }

  const parsed = runBatchArgsSchema.safeParse({
    concurrency: values.concurrency,
    prompt: values.prompt,
    yes: values.yes,
    agents: parseAgentArgs(values.agents),
    claudeEfforts: parseClaudeEfforts(values['claude-efforts']),
    claudeEffort: values['claude-effort'],
    codexEffort: values['codex-effort'],
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(issues);
  }

  return parsed.data;
}

function parseAgentArgs(value?: string) {
  if (value == null) {
    return undefined;
  }

  return value
    .split(',')
    .map((agent) => agent.trim())
    .filter(Boolean);
}

function parseClaudeEfforts(value?: string) {
  if (value == null) {
    return undefined;
  }

  return value
    .split(',')
    .map((effort) => effort.trim())
    .filter(Boolean);
}

function resolveBatchAgents(agents?: RunBatchOptions['agents']) {
  if (agents == null || agents.length === 0) {
    return [...BATCH_DEFAULT_AGENT_IDS];
  }

  return BATCH_AGENT_IDS.filter((agent) => agents.includes(agent));
}

function resolveClaudeEfforts(options: {
  claudeEfforts?: RunBatchOptions['claudeEfforts'];
  claudeEffort?: RunBatchOptions['claudeEffort'];
}) {
  if (options.claudeEfforts != null && options.claudeEfforts.length > 0) {
    return [...new Set(options.claudeEfforts)];
  }

  if (options.claudeEffort != null) {
    return [options.claudeEffort];
  }

  return [...BATCH_DEFAULT_CLAUDE_EFFORTS];
}

function formatBatchTimestamp(date: Date) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function formatExitResult(result: Pick<BatchRunSummaryEntry, 'exitCode' | 'signal'>) {
  return result.signal ? `signal=${result.signal}` : `exit=${result.exitCode ?? 'null'}`;
}

async function waitForChild(child: SpawnedBatchChild) {
  return new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; error?: Error }>(
    (resolveResult) => {
      let settled = false;

      const resolveOnce = (result: {
        exitCode: number | null;
        signal: NodeJS.Signals | null;
        error?: Error;
      }) => {
        if (settled) {
          return;
        }
        settled = true;
        resolveResult(result);
      };

      child.once('error', (error) => {
        resolveOnce({ exitCode: null, signal: null, error });
      });
      child.once('close', (exitCode, signal) => {
        resolveOnce({ exitCode, signal });
      });
    }
  );
}

async function closeLogStream(logStream: ReturnType<typeof createWriteStream>) {
  logStream.end();
  await once(logStream, 'finish');
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function formatError(error: Error) {
  return error.stack ?? `${error.name}: ${error.message}`;
}

if (esMain(import.meta.url)) {
  try {
    const parsed = parseRunBatchArgs(process.argv.slice(2));
    if ('help' in parsed) {
      console.log(
        formatHelp(
          `node ${NODE_EVAL_RUN_BATCH_SCRIPT} [options]`,
          'Run a batch of eval trials across all benchmark projects.',
          runBatchOptions
        )
      );
      process.exit(0);
    }
    process.exitCode = await main(parsed);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
