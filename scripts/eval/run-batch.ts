import { spawn as spawnChild, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { parseArgs } from 'node:util';

import pLimit from 'p-limit';
import { z } from 'zod';

import { esMain } from '../utils/esmain.ts';
import { CLAUDE_EFFORTS, CODEX_EFFORTS, type AgentVariant } from './lib/agents/config.ts';
import { PROJECTS } from './lib/projects.ts';
import { EVAL_ROOT, REPO_ROOT } from './lib/utils.ts';

export const BATCH_PROJECT_NAMES = ['edgy', 'baklava', 'wikitok'] as const;
export const BATCH_DEFAULT_EFFORTS = {
  claude: 'max',
  codex: 'xhigh',
} as const;
export const BATCH_VARIANTS = buildBatchVariants();
export const BATCH_REPETITIONS = 10;
export const BATCH_CONCURRENCY = 8;

export interface BatchRunDescriptor {
  project: (typeof BATCH_PROJECT_NAMES)[number];
  agent: (typeof BATCH_VARIANTS)[number]['agent'];
  model: (typeof BATCH_VARIANTS)[number]['model'];
  effort: (typeof BATCH_VARIANTS)[number]['effort'];
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
  spawn?: (
    command: string,
    args: string[],
    options: SpawnOptionsWithoutStdio & { stdio: ['ignore', 'pipe', 'pipe'] }
  ) => SpawnedBatchChild;
}

export async function main(options: RunBatchOptions = {}, deps: BatchRunnerDeps = {}) {
  const summary = await runBatch(options, deps);
  return summary.failed > 0 ? 1 : 0;
}

export async function runBatch(
  options: RunBatchOptions = {},
  deps: BatchRunnerDeps = {}
): Promise<BatchSummary> {
  const descriptors =
    options.descriptors ??
    buildBatchRunDescriptors({
      claudeEffort: options.claudeEffort,
      codexEffort: options.codexEffort,
    });
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
    claudeEffort?: RunBatchOptions['claudeEffort'];
    codexEffort?: RunBatchOptions['codexEffort'];
  } = {}
): AgentVariant[] {
  return [
    {
      agent: 'claude',
      model: 'opus-4.6',
      effort: options.claudeEffort ?? BATCH_DEFAULT_EFFORTS.claude,
    },
    {
      agent: 'codex',
      model: 'gpt-5.4',
      effort: options.codexEffort ?? BATCH_DEFAULT_EFFORTS.codex,
    },
  ];
}

export function buildBatchRunDescriptors(
  options: {
    claudeEffort?: RunBatchOptions['claudeEffort'];
    codexEffort?: RunBatchOptions['codexEffort'];
  } = {}
): BatchRunDescriptor[] {
  const knownProjects = new Set(PROJECTS.map((project) => project.name));

  for (const project of BATCH_PROJECT_NAMES) {
    if (!knownProjects.has(project)) {
      throw new Error(`Configured batch project is missing from PROJECTS: ${project}`);
    }
  }

  const descriptors: BatchRunDescriptor[] = [];
  const variants =
    options.claudeEffort == null && options.codexEffort == null
      ? BATCH_VARIANTS
      : buildBatchVariants(options);

  for (const project of BATCH_PROJECT_NAMES) {
    for (const variant of variants) {
      for (let repetition = 1; repetition <= BATCH_REPETITIONS; repetition += 1) {
        descriptors.push(createBatchRunDescriptor(project, variant, repetition));
      }
    }
  }

  return descriptors;
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
    const child = context.spawn('node', descriptor.args, {
      cwd: context.repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
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
  repetition: number
): BatchRunDescriptor {
  const label = `${project}-${variant.agent}-${variant.model}-${variant.effort}-r${String(repetition).padStart(2, '0')}`;
  return {
    project,
    agent: variant.agent,
    model: variant.model,
    effort: variant.effort,
    repetition,
    label,
    args: [
      './scripts/eval/eval.ts',
      '-p',
      project,
      '-a',
      variant.agent,
      '-m',
      variant.model,
      '-e',
      variant.effort,
    ],
  };
}

function defaultSpawn(
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio & { stdio: ['ignore', 'pipe', 'pipe'] }
) {
  return spawnChild(command, args, options);
}

const runBatchArgsSchema = z.object({
  concurrency: z.coerce.number().int().positive().optional(),
  claudeEffort: z.enum(CLAUDE_EFFORTS).optional(),
  codexEffort: z.enum(CODEX_EFFORTS).optional(),
});

export function parseRunBatchArgs(
  argv: string[]
): Pick<RunBatchOptions, 'claudeEffort' | 'codexEffort' | 'concurrency'> {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    options: {
      concurrency: { type: 'string' },
      'claude-effort': { type: 'string' },
      'codex-effort': { type: 'string' },
    },
  });

  const parsed = runBatchArgsSchema.safeParse({
    concurrency: values.concurrency,
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
    process.exitCode = await main(parseRunBatchArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
