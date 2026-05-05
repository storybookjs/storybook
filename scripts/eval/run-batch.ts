import { spawn as spawnChild, type SpawnOptions } from 'node:child_process';
import { once } from 'node:events';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { parseArgs } from 'node:util';

import pLimit from 'p-limit';
import { z } from 'zod';

import { createInterface } from 'node:readline/promises';

import { esMain } from '../utils/esmain.ts';
import { AGENTS, CLAUDE_EFFORTS, CODEX_EFFORTS, type AgentVariant } from './lib/agents/config.ts';
import { PROJECTS } from './lib/projects.ts';
import {
  EVAL_ROOT,
  formatHelp,
  listPrompts,
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
  /** Required when `descriptors` are not provided — prompt variant name from the CLI registry. */
  prompt?: string;
  /** Optional list of prompts to fan out across in a single batch (in addition to or in place of `prompt`). */
  prompts?: string[];
  /** Skip interactive confirmation (large API / token usage). */
  yes?: boolean;
  agents?: (typeof BATCH_AGENT_IDS)[number][];
  claudeEfforts?: (typeof CLAUDE_EFFORTS)[number][];
  claudeEffort?: (typeof CLAUDE_EFFORTS)[number];
  codexEffort?: (typeof CODEX_EFFORTS)[number];
  /** Restrict the batch to a subset of projects. Defaults to BATCH_PROJECT_NAMES. */
  projects?: (typeof BATCH_PROJECT_NAMES)[number][];
  /** Repetitions per (project × variant). Defaults to BATCH_REPETITIONS. */
  repetitions?: number;
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
      prompts: requireBatchPrompts(options),
      agents: options.agents,
      claudeEfforts: options.claudeEfforts,
      claudeEffort: options.claudeEffort,
      codexEffort: options.codexEffort,
      projects: options.projects,
      repetitions: options.repetitions,
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
  const total = descriptors.length;
  const padTotal = String(total).length;
  const shortLabel = (descriptor: BatchRunDescriptor) =>
    `${descriptor.project} r${String(descriptor.repetition).padStart(2, '0')}`;

  for (const line of formatBatchHeader({
    batchTimestamp,
    descriptors,
    concurrency,
    logsDir,
  })) {
    log(line);
  }

  await Promise.all(
    descriptors.map((descriptor, index) =>
      limit(async () => {
        started += 1;
        log(
          `[${String(started).padStart(padTotal)}/${total}] start  ${shortLabel(descriptor)}`
        );

        const result = await runBatchDescriptor(descriptor, {
          repoRoot,
          logsDir,
          now,
          spawn,
        });
        results[index] = result;

        finished += 1;
        const reason = result.status === 'failed' ? await readFailureReason(result.logPath) : '';
        const tag = result.status === 'success' ? '✓' : '✗';
        const exitInfo =
          result.status === 'success' ? '' : ` ${formatExitResult(result)}`;
        log(
          `[${String(finished).padStart(padTotal)}/${total}] ${tag} ${shortLabel(descriptor)} ${formatDuration(result.durationMs)}${exitInfo}${reason ? ` — ${reason}` : ''}`
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

  log('');
  log(
    `Finished eval batch ${batchTimestamp} in ${formatDuration(summary.durationMs)}: ${summary.succeeded}/${summary.totalRuns} succeeded${summary.failed > 0 ? `, ${summary.failed} failed` : ''}`
  );

  for (const line of formatPerProjectSummary(summary.runs)) {
    log(line);
  }

  if (summary.failed > 0) {
    log('');
    log('Failures:');
    for (const run of summary.runs) {
      if (run.status === 'success') continue;
      const reason = await readFailureReason(run.logPath);
      log(`  - ${run.label}${reason ? `\n      ${reason}` : ''}\n      ${run.logPath}`);
    }
  }

  return summary;
}

const FAILURE_REASON_MAX_LEN = 200;

/** Read the most informative trailing line from a failed trial log to surface inline. */
async function readFailureReason(logPath: string): Promise<string> {
  try {
    const text = await readFile(logPath, 'utf8');
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return '';
    const errorLine = [...lines]
      .reverse()
      .find((line) => /error|abort|timeout|failed/i.test(line) && !line.startsWith('at '));
    const candidate = errorLine ?? lines[lines.length - 1];
    return candidate.length > FAILURE_REASON_MAX_LEN
      ? `${candidate.slice(0, FAILURE_REASON_MAX_LEN - 1)}…`
      : candidate;
  } catch {
    return '';
  }
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

export function buildBatchRunDescriptors(options: {
  prompt?: string;
  prompts?: string[];
  agents?: RunBatchOptions['agents'];
  claudeEfforts?: RunBatchOptions['claudeEfforts'];
  claudeEffort?: RunBatchOptions['claudeEffort'];
  codexEffort?: RunBatchOptions['codexEffort'];
  projects?: RunBatchOptions['projects'];
  repetitions?: number;
}): BatchRunDescriptor[] {
  const knownProjects = new Set(PROJECTS.map((project) => project.name));

  for (const project of BATCH_PROJECT_NAMES) {
    if (!knownProjects.has(project)) {
      throw new Error(`Configured batch project is missing from PROJECTS: ${project}`);
    }
  }

  const projects = resolveBatchProjects(options.projects);
  const prompts = resolveBatchPrompts({ prompt: options.prompt, prompts: options.prompts });

  const descriptors: BatchRunDescriptor[] = [];
  const variants =
    options.agents == null &&
    options.claudeEfforts == null &&
    options.claudeEffort == null &&
    options.codexEffort == null
      ? BATCH_VARIANTS
      : buildBatchVariants(options);

  const totalRepetitions = options.repetitions ?? BATCH_REPETITIONS;
  for (let repetition = 1; repetition <= totalRepetitions; repetition += 1) {
    for (const prompt of prompts) {
      for (const variant of variants) {
        for (const project of projects) {
          descriptors.push(createBatchRunDescriptor(project, variant, repetition, prompt));
        }
      }
    }
  }

  return descriptors;
}

function resolveBatchPrompts(options: { prompt?: string; prompts?: string[] }): string[] {
  const merged = [
    ...(options.prompts ?? []),
    ...(options.prompt != null ? [options.prompt] : []),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  if (merged.length === 0) {
    throw new Error(
      'runBatch: pass `prompt` or `prompts` (prompt template basename) or provide `descriptors` explicitly.'
    );
  }

  const available = listPrompts();
  const lookup = new Map(available.map((name) => [name.toLowerCase(), name]));

  const seen = new Set<string>();
  const ordered: string[] = [];
  const unknown: string[] = [];
  for (const value of merged) {
    const canonical = lookup.get(value.toLowerCase());
    if (!canonical) {
      unknown.push(value);
      continue;
    }
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    ordered.push(canonical);
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unknown prompt(s): ${unknown.join(', ')}. Available prompts: ${available.join(', ')}`
    );
  }

  return ordered;
}

function resolveBatchProjects(projects?: RunBatchOptions['projects']) {
  if (projects == null || projects.length === 0) {
    return [...BATCH_PROJECT_NAMES];
  }

  const allowed = new Set<string>(BATCH_PROJECT_NAMES);
  const unknown = projects.filter((project) => !allowed.has(project));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown project(s): ${unknown.join(', ')}. Available: ${BATCH_PROJECT_NAMES.join(', ')}`
    );
  }

  const seen = new Set<string>();
  const ordered: (typeof BATCH_PROJECT_NAMES)[number][] = [];
  for (const project of projects) {
    if (seen.has(project)) continue;
    seen.add(project);
    ordered.push(project);
  }
  return ordered;
}

function requireBatchPrompts(options: RunBatchOptions): string[] {
  return resolveBatchPrompts({ prompt: options.prompt, prompts: options.prompts });
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

function sanitizeLabelSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function createBatchRunDescriptor(
  project: BatchRunDescriptor['project'],
  variant: AgentVariant,
  repetition: number,
  prompt: string
): BatchRunDescriptor {
  const label = [
    project,
    variant.agent,
    variant.model,
    variant.effort,
    prompt,
    `r${String(repetition).padStart(2, '0')}`,
  ]
    .map(sanitizeLabelSegment)
    .join('-');
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

const runBatchArgsSchema = z
  .object({
    concurrency: z.coerce.number().int().positive().optional(),
    prompt: z.string().min(1).optional(),
    prompts: z.array(z.string().min(1)).nonempty().optional(),
    yes: z.boolean().optional(),
    agents: z.array(z.enum(BATCH_AGENT_IDS)).nonempty().optional(),
    claudeEfforts: z.array(z.enum(CLAUDE_EFFORTS)).nonempty().optional(),
    claudeEffort: z.enum(CLAUDE_EFFORTS).optional(),
    codexEffort: z.enum(CODEX_EFFORTS).optional(),
    projects: z.array(z.string().min(1)).nonempty().optional(),
    repetitions: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => value.prompt != null || value.prompts != null, {
    message: 'pass --prompt or --prompts',
    path: ['prompt'],
  });

const runBatchOptions = {
  concurrency: { type: 'string' as const, description: 'Max concurrent runs (default: 8)' },
  prompt: {
    type: 'string' as const,
    description:
      'Prompt variant name (required unless --prompts is set; registered in code/lib/cli-storybook/src/ai/setup-prompts/)',
  },
  prompts: {
    type: 'string' as const,
    description: 'Comma-separated list of prompt variant names to fan out across',
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
  projects: {
    type: 'string' as const,
    description: 'Comma-separated project names to run (default: all batch projects)',
  },
  repetitions: {
    type: 'string' as const,
    description: `Repetitions per (project × variant) (default: ${BATCH_REPETITIONS})`,
  },
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
      | 'prompts'
      | 'projects'
      | 'yes'
      | 'repetitions'
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
    prompts: parseList(values.prompts),
    yes: values.yes,
    agents: parseAgentArgs(values.agents),
    claudeEfforts: parseClaudeEfforts(values['claude-efforts']),
    claudeEffort: values['claude-effort'],
    codexEffort: values['codex-effort'],
    projects: parseProjects(values.projects),
    repetitions: values.repetitions,
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

function parseProjects(value?: string) {
  return parseList(value);
}

function parseList(value?: string) {
  if (value == null) {
    return undefined;
  }
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
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

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

function uniqueSorted(values: readonly string[]) {
  return [...new Set(values)].sort();
}

export function formatBatchHeader(opts: {
  batchTimestamp: string;
  descriptors: BatchRunDescriptor[];
  concurrency: number;
  logsDir: string;
}): string[] {
  const { batchTimestamp, descriptors, concurrency, logsDir } = opts;
  const projects = uniqueSorted(descriptors.map((d) => d.project));
  const agents = uniqueSorted(descriptors.map((d) => d.agent));
  const models = uniqueSorted(descriptors.map((d) => d.model));
  const efforts = uniqueSorted(descriptors.map((d) => d.effort));
  const prompts = uniqueSorted(descriptors.map((d) => d.prompt));
  const reps = Math.max(...descriptors.map((d) => d.repetition));

  return [
    `Eval batch ${batchTimestamp}`,
    `  runs:        ${descriptors.length} (${projects.length} projects × ${agents.length} agent(s) × ${efforts.length} effort(s) × ${reps} rep(s))`,
    `  prompt:      ${prompts.join(', ')}`,
    `  agents:      ${agents.join(', ')}`,
    `  models:      ${models.join(', ')}`,
    `  efforts:     ${efforts.join(', ')}`,
    `  projects:    ${projects.join(', ')}`,
    `  concurrency: ${concurrency}`,
    `  logs:        ${logsDir}`,
    '',
  ];
}

export function formatPerProjectSummary(runs: BatchRunSummaryEntry[]): string[] {
  if (runs.length === 0) return [];

  const byProject = new Map<string, BatchRunSummaryEntry[]>();
  for (const run of runs) {
    const list = byProject.get(run.project) ?? [];
    list.push(run);
    byProject.set(run.project, list);
  }

  const projectCol = Math.max('project'.length, ...[...byProject.keys()].map((p) => p.length));
  const headers = ['project', 'ok', 'min', 'med', 'max'];
  const rows = [...byProject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([project, projectRuns]) => {
      const ok = projectRuns.filter((r) => r.status === 'success').length;
      const sortedDurations = projectRuns.map((r) => r.durationMs).sort((a, b) => a - b);
      const median = sortedDurations[Math.floor(sortedDurations.length / 2)];
      return [
        project,
        `${ok}/${projectRuns.length}`,
        formatDuration(sortedDurations[0]),
        formatDuration(median),
        formatDuration(sortedDurations[sortedDurations.length - 1]),
      ];
    });

  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length))
  );
  widths[0] = Math.max(widths[0], projectCol);

  const fmtRow = (cells: string[]) =>
    `  ${cells.map((cell, i) => (i === 0 ? cell.padEnd(widths[i]) : cell.padStart(widths[i]))).join('  ')}`;

  return ['', 'Per-project summary:', fmtRow(headers), ...rows.map(fmtRow)];
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
