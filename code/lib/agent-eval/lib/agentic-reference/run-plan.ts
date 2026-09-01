// Planning logic for scripts/run-plan.ts: turns one plan config into a
// sequence of agent-eval invocations, each sized to fit this machine, that
// collect only the repetitions still missing.
//
// `agent-eval run-all` has no concurrency cap and calls saveResults once,
// after every attempt settles. A resource failure that throws instead of
// returning a failed run (a full disk, a Docker socket error) unwinds past
// saveResults and discards every completed sibling run in the same
// experiment. Slicing the matrix into batches of at most `parallelMax`
// sandboxes each, with their own saveResults, caps that loss to one batch.
import { stripAnsi } from '../utils/colors.ts';
import { matchesAnySelector, resolveEvalSelection } from './selection.ts';
import { PLAIN_STYLE, type OutputStyle } from './style.ts';

/**
 * A data-collection plan: which cells to sample, how deeply, and how much of
 * this machine to use at once.
 */
export interface RunPlan {
  /**
   * Experiments to collect, by full name (`agentic-ref-cc-full-opus-high`) or
   * glob (`agentic-ref-cc-*`). Names resolve against the case registry, so a
   * typo fails here rather than widening a paid run.
   */
  experiments: string[];
  /** Evals to collect, by name, number (703) or glob (70*). */
  evals: string[];
  /**
   * Target sample size per (experiment, eval) pair. Runs already on disk
   * count towards it, so a pair holding 6 of 10 collects 4.
   */
  runs: number;
  /**
   * Hard ceiling on sandboxes running at once. Empirically 20 on this
   * hardware; every batch is cut to stay at or under it.
   */
  parallelMax: number;
  /**
   * Ignore what is already on disk and collect the full target for every cell.
   * Default false.
   */
  force?: boolean;
  /**
   * Reuse cutoff: an ISO date or datetime. Runs saved before it don't count
   * towards a pair's target. Use it for environment changes a measurement
   * can't see, e.g. a rebuilt MCP package at the same branch or a new
   * sandbox image.
   */
  since?: string;
  /**
   * Keep infra/timeout runs as final results instead of letting the classifier
   * delete them. Default false, so infra noise stays out of the sample.
   */
  ackFailures?: boolean;
}

export interface ResolvedPlanOptions {
  runs: number;
  parallelMax: number;
  force: boolean;
  ackFailures: boolean;
  /** The reuse cutoff, or null when the plan sets none. */
  since: Date | null;
}

/** One (experiment, eval) pair the plan covers. */
export interface PlanCell {
  experiment: string;
  evalName: string;
}

export interface ResolvedRunPlan {
  plan: ResolvedPlanOptions;
  /** Experiment names, in the order the plan listed them. */
  experiments: string[];
  /** Eval names, in registry order. */
  evals: string[];
  /** Every (experiment, eval) pair the plan covers, eval-major. */
  cells: PlanCell[];
}

/**
 * Expands experiment selection tokens against the known experiment names.
 * Mirrors resolveEvalSelection: a token matching nothing throws, rather than
 * silently resolving to zero experiments.
 */
export function resolveExperimentSelection(
  tokens: readonly string[],
  known: readonly string[]
): string[] {
  if (tokens.length === 0) {
    throw new Error('a plan must name at least one experiment.');
  }

  const selected: string[] = [];
  for (const token of tokens) {
    const matches = known.filter((name) => matchesAnySelector(name, [token]));
    if (matches.length === 0) {
      throw new Error(`"${token}" matches no known experiment. Known: ${known.join(', ')}.`);
    }
    for (const match of matches) {
      if (!selected.includes(match)) {
        selected.push(match);
      }
    }
  }
  return selected;
}

function assertPositiveInteger(field: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  return value;
}

/**
 * Resolves a plan's selections into the cells it covers, eval-major: every
 * experiment for eval A, then every experiment for eval B. That way a plan
 * cut short still holds a balanced sample, since every experiment has the
 * same evals collected first — experiment-major would leave the last
 * experiments with nothing.
 */
export function resolveRunPlan(
  plan: RunPlan,
  known: { experiments: readonly string[]; evals: readonly string[] }
): ResolvedRunPlan {
  const runs = assertPositiveInteger('runs', plan.runs);
  const parallelMax = assertPositiveInteger('parallelMax', plan.parallelMax);

  const experiments = resolveExperimentSelection(plan.experiments, known.experiments);
  const evals = resolveEvalSelection(plan.evals, known.evals);

  const cells: PlanCell[] = [];
  for (const evalName of evals) {
    for (const experiment of experiments) {
      cells.push({ experiment, evalName });
    }
  }

  return {
    plan: {
      runs,
      parallelMax,
      force: plan.force ?? false,
      ackFailures: plan.ackFailures ?? false,
      since: parseSince(plan.since),
    },
    experiments,
    evals,
    cells,
  };
}

// --- the reuse cutoff ------------------------------------------------------

/**
 * Reads the `since` cutoff out of a plan config. A bare date means UTC
 * midnight, matching how result directory names are stamped.
 */
export function parseSince(value: string | undefined): Date | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `since must be an ISO date or datetime (e.g. "2026-08-16"); received "${value}".`
    );
  }
  return parsed;
}

// --- counting what is already collected ------------------------------------

/** One eval directory found under a result directory. */
export interface StoredSample {
  /** Result directory, relative to the experiment's results directory. */
  dir: string;
  /** When it was collected, from the directory name. */
  at: Date | null;
  /** Whether it measures what its cell measures today. */
  current: boolean;
  /** How many collected runs it holds. */
  runs: number;
}

export type SampleVerdict = 'qualifying' | 'superseded' | 'predates-cutoff' | 'undatable';

/** Whether a stored sample counts towards its cell's target. */
export function judgeSample(sample: StoredSample, since: Date | null): SampleVerdict {
  if (!sample.current) {
    return 'superseded';
  }
  if (since === null) {
    return 'qualifying';
  }
  if (sample.at === null) {
    return 'undatable';
  }
  return sample.at.getTime() < since.getTime() ? 'predates-cutoff' : 'qualifying';
}

/** A pair, with what it already has and what is left to collect. */
export interface CellPlan extends PlanCell {
  /** The plan's target sample size. */
  target: number;
  /** Runs already on disk that count towards the target; can exceed it. */
  qualifying: number;
  /** Runs still to collect. */
  deficit: number;
  /** Runs on disk that do not count, by reason — for explaining the deficit. */
  discounted: Record<Exclude<SampleVerdict, 'qualifying'>, number>;
}

/**
 * Works out how much of a pair is still missing.
 *
 * The deficit is clamped at zero: a pair over-collected by an earlier round
 * has nothing left to collect, and its qualifying count stays the real one
 * so over-collection is visible.
 */
export function planCell(
  cell: PlanCell,
  samples: readonly StoredSample[],
  options: { target: number; since: Date | null; force: boolean }
): CellPlan {
  const discounted = { superseded: 0, 'predates-cutoff': 0, undatable: 0 };
  let qualifying = 0;

  if (!options.force) {
    for (const sample of samples) {
      const verdict = judgeSample(sample, options.since);
      if (verdict === 'qualifying') {
        qualifying += sample.runs;
      } else {
        discounted[verdict] += sample.runs;
      }
    }
  }

  return {
    ...cell,
    target: options.target,
    qualifying,
    deficit: Math.max(0, options.target - qualifying),
    discounted,
  };
}

/** Why a pair has to be collected, in one phrase, for the plan output. */
export function explainDeficit(cell: CellPlan, style: OutputStyle = PLAIN_STYLE): string {
  const discounted = Object.entries(cell.discounted)
    .filter(([, runs]) => runs > 0)
    .map(([reason, runs]) => `${runs} ${reason.replace('-', ' ')}`);
  const discardedNote =
    discounted.length === 0 ? '' : style.dim(` (discounting ${discounted.join(', ')})`);

  if (cell.qualifying === 0) {
    return `no qualifying runs${discardedNote}`;
  }
  return `${cell.qualifying}/${cell.target} runs already collected${discardedNote}`;
}

// --- batches ---------------------------------------------------------------

/** One agent-eval invocation: cells of one eval, sharing one sample size. */
export interface PlanBatch {
  /** 1-based position in the plan. */
  index: number;
  evalName: string;
  experiments: string[];
  /** Repetitions this invocation asks for — the shared deficit of its cells. */
  runs: number;
  /** Sandboxes it starts at once: experiments.length × runs. */
  parallel: number;
}

/**
 * Cuts the pairs that still need work into invocations. One invocation
 * carries a single `--runs`, so pairs share a batch only when their deficits
 * match; within an eval they're grouped by deficit, deepest first, so batches
 * stay one eval wide and keep the eval-major order intact.
 *
 * A deficit larger than parallelMax is collected in waves: sequential
 * invocations of at most parallelMax repetitions each. Every invocation runs
 * with --force and saves its own result directory, and a pair's sample is
 * counted across all of its directories, so the waves add up to one sample.
 */
export function planBatches(
  cells: readonly CellPlan[],
  evals: readonly string[],
  parallelMax: number
): PlanBatch[] {
  const batches: PlanBatch[] = [];

  for (const evalName of evals) {
    const outstanding = cells.filter((cell) => cell.evalName === evalName && cell.deficit > 0);

    const byDeficit = new Map<number, string[]>();
    for (const cell of outstanding) {
      // Wave slices of parallelMax fill a batch on their own (perBatch
      // below is 1), so one pair's waves can never share an invocation.
      let remaining = cell.deficit;
      while (remaining > 0) {
        const slice = Math.min(remaining, parallelMax);
        const group = byDeficit.get(slice) ?? [];
        group.push(cell.experiment);
        byDeficit.set(slice, group);
        remaining -= slice;
      }
    }

    for (const deficit of [...byDeficit.keys()].sort((a, b) => b - a)) {
      const experiments = byDeficit.get(deficit)!;
      const perBatch = Math.max(1, Math.floor(parallelMax / deficit));
      for (let start = 0; start < experiments.length; start += perBatch) {
        const chunk = experiments.slice(start, start + perBatch);
        batches.push({
          index: batches.length + 1,
          evalName,
          experiments: chunk,
          runs: deficit,
          parallel: chunk.length * deficit,
        });
      }
    }
  }

  return batches;
}

// --- reading the runner's output -------------------------------------------

export type ResourceSignalKind = 'memory' | 'disk' | 'billing';

export interface ResourceSignal {
  kind: ResourceSignalKind;
  /** The matched line, for the report. */
  evidence: string;
}

// Exit 137 is a SIGKILL, which on an unconstrained Docker container is the host
// OOM killer picking a victim — the sandboxes are created with no memory limit
// of their own, so nothing else reports the pressure.
const SIGNAL_PATTERNS: { kind: ResourceSignalKind; pattern: RegExp }[] = [
  {
    kind: 'memory',
    pattern: /OOMKilled|Cannot allocate memory|\bENOMEM\b|out of memory|exit code 137/i,
  },
  { kind: 'disk', pattern: /\bENOSPC\b|no space left on device/i },
  { kind: 'billing', pattern: /insufficient funds/i },
];

/** Resource-exhaustion evidence in a batch's output, deduplicated by kind. */
export function scanResourceSignals(output: string): ResourceSignal[] {
  const found = new Map<ResourceSignalKind, ResourceSignal>();
  // The runner's chalk keeps colouring a pipe when FORCE_COLOR is set, and the
  // patterns have to match mid-line.
  for (const line of stripAnsi(output).split('\n')) {
    for (const { kind, pattern } of SIGNAL_PATTERNS) {
      if (!found.has(kind) && pattern.test(line)) {
        found.set(kind, { kind, evidence: line.trim().slice(0, 200) });
      }
    }
  }
  return [...found.values()];
}

/**
 * Signals where continuing wastes wall-clock: a full disk saves no results,
 * and billing fails identically on every later batch. Memory pressure isn't
 * one of them — each batch's containers are gone before the next starts.
 */
export function isPlanStoppingSignal(signal: ResourceSignal): boolean {
  return signal.kind === 'disk' || signal.kind === 'billing';
}

/**
 * The parallelMax to suggest after memory pressure: halved, but never below
 * `runs` (a batch can't be smaller than one pair's repetitions). Returns null
 * when already at that floor, where `runs` is the only remaining knob.
 */
export function narrowedParallelMax(parallelMax: number, runs: number): number | null {
  const halved = Math.floor(parallelMax / 2);
  return halved < runs ? null : Math.max(halved, runs);
}

// --- gaps ------------------------------------------------------------------

export interface CellOutcome {
  experiment: string;
  evalName: string;
  /** Repetitions this batch set out to collect. */
  expected: number;
  /** Repetitions that reached disk. */
  collected: number;
}

/**
 * The command that collects a pair's missing repetitions. --force is required
 * because the shortfall already left saved results, which the harness would
 * otherwise treat as done.
 */
export function topUpCommand(cell: CellOutcome): string {
  return (
    `yarn workspace agent-eval run eval:agentic-ref --experiments ${cell.experiment} --evals ${cell.evalName} ` +
    `--runs ${cell.expected - cell.collected} --force`
  );
}
