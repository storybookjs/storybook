#!/usr/bin/env node
// Runs a plan config in batches. One `agent-eval run-all` invocation starts
// every attempt at once and saves once, at the end, so a single resource
// failure can discard every completed run with it; batching caps that loss
// at one batch.
//
//   yarn workspace agent-eval run eval:plan --plan <name-or-path> [--dry]
//
//   --plan, --config  the plan config, by bare name (1-levels-create) or path
//                     (default AGENTIC_REF_CONFIG, then plans/default.plan.ts)
//   --dry             print what would be collected and spend nothing
//
// A plan config is a TS module default-exporting a RunPlan — experiments,
// evals, runs, parallelMax — see lib/agentic-reference/run-plan.ts and
// plans/example.plan.ts.
//
// The plan counts the qualifying runs each experiment/eval pair already has
// and asks only for the difference. Which stored runs qualify is decided in
// lib/agentic-reference/comparability.ts, shared with the offline analyzer.
//
// Nothing is retried. A batch that fails is recorded and the plan moves on,
// so an unattended run ends with a complete account of what it collected.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

import { AGENTIC_REF_EVAL_REGISTRY, knownExperimentNames } from '../lib/agentic-reference/cases.ts';
import { countCollectedRuns } from '../lib/agentic-reference/collected-runs.ts';
import { AGENT_EVAL_ROOT, RESULTS_DIR, RUNNER } from '../lib/agentic-reference/constants.ts';
import { ansiStyle } from '../lib/agentic-reference/style.ts';
import { isCurrentSample, parseResultTimestamp } from '../lib/agentic-reference/comparability.ts';
import { loadPlanConfig, resolvePlanPath } from '../lib/agentic-reference/plan-config.ts';
import { findResultDirs } from '../lib/agentic-reference/results-tree.ts';
import { selectionFlags } from '../lib/agentic-reference/selection.ts';
import {
  type CellOutcome,
  type CellPlan,
  type PlanBatch,
  type ResolvedRunPlan,
  type ResourceSignal,
  type StoredSample,
  explainDeficit,
  isPlanStoppingSignal,
  narrowedParallelMax,
  planBatches,
  planCell,
  resolveRunPlan,
  scanResourceSignals,
  topUpCommand,
} from '../lib/agentic-reference/run-plan.ts';

const DEFAULT_CONFIG = join('plans', 'default.plan.ts');
const outStyle = ansiStyle(process.stdout);
const errStyle = ansiStyle(process.stderr);

function fail(message: string): never {
  console.error(`run-plan: ${message}`);
  process.exit(1);
}

interface BatchOutcome {
  batch: PlanBatch;
  /** Cells this batch set out to collect. */
  cells: CellOutcome[];
  exitCode: number | null;
  durationMs: number;
  signals: ResourceSignal[];
  /** Set when the batch could not be started or judged at all. */
  error?: string;
}

function collectedRuns(outcome: BatchOutcome): number {
  return outcome.cells.reduce((total, cell) => total + cell.collected, 0);
}

function expectedRuns(outcome: BatchOutcome): number {
  return outcome.cells.reduce((total, cell) => total + cell.expected, 0);
}

// Runs without a project tree hold nothing to measure (see
// lib/agentic-reference/collected-runs.ts).
function countSavedRuns(experiment: string, evalName: string, dirs: readonly string[]): number {
  let total = 0;
  for (const dir of dirs) {
    total += countCollectedRuns(join(RESULTS_DIR, experiment, dir, evalName));
  }
  return total;
}

/** Every stored sample of one pair, whether or not it still counts. */
function storedSamples(experiment: string, evalName: string): StoredSample[] {
  const samples: StoredSample[] = [];
  for (const dir of findResultDirs(experiment)) {
    const evalDir = join(RESULTS_DIR, experiment, dir, evalName);
    const runs = countCollectedRuns(evalDir);
    if (runs === 0) {
      continue;
    }
    samples.push({
      dir,
      at: parseResultTimestamp(basename(dir)),
      current: isCurrentSample(evalDir, { experiment, evalName }),
      runs,
    });
  }
  return samples;
}

function planCells(resolved: ResolvedRunPlan): CellPlan[] {
  const { runs, since, force } = resolved.plan;

  return resolved.cells.map((cell) =>
    planCell(cell, force ? [] : storedSamples(cell.experiment, cell.evalName), {
      target: runs,
      since,
      force,
    })
  );
}

interface ChildResult {
  exitCode: number | null;
  output: string;
}

// Runs the agentic-ref runner as a child process: one code path, with
// process isolation. Output is streamed live and kept, for scanning
// resource signals afterward.
function runRunner(args: string[]): Promise<ChildResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      cwd: AGENT_EVAL_ROOT,
      env: process.env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let output = '';
    const capture = (stream: NodeJS.ReadableStream, sink: NodeJS.WriteStream) => {
      stream.setEncoding('utf8');
      stream.on('data', (chunk: string) => {
        output += chunk;
        sink.write(chunk);
      });
    };
    capture(child.stdout, process.stdout);
    capture(child.stderr, process.stderr);

    child.on('error', rejectPromise);
    child.on('close', (exitCode) => resolvePromise({ exitCode, output }));
  });
}

// --force on every invocation: the harness's own cache is all-or-nothing and
// would skip a pair that only has a partial sample.
function runnerArgs(batch: PlanBatch, resolved: ResolvedRunPlan): string[] {
  return [
    '--experiments',
    batch.experiments.join(','),
    '--evals',
    batch.evalName,
    '--runs',
    String(batch.runs),
    '--force',
    ...(resolved.plan.ackFailures ? ['--ack-failures'] : []),
  ];
}

async function runBatch(batch: PlanBatch, resolved: ResolvedRunPlan): Promise<BatchOutcome> {
  const started = Date.now();
  const before = new Map(batch.experiments.map((name) => [name, new Set(findResultDirs(name))]));

  const run = await runRunner(runnerArgs(batch, resolved));

  const cells: CellOutcome[] = batch.experiments.map((experiment) => {
    const added = findResultDirs(experiment).filter((name) => !before.get(experiment)!.has(name));
    return {
      experiment,
      evalName: batch.evalName,
      expected: batch.runs,
      collected: countSavedRuns(experiment, batch.evalName, added),
    };
  });

  return {
    batch,
    cells,
    exitCode: run.exitCode,
    durationMs: Date.now() - started,
    signals: scanResourceSignals(run.output),
  };
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return minutes === 0 ? `${seconds}s` : `${minutes}m${String(seconds).padStart(2, '0')}s`;
}

function describeBatch(batch: PlanBatch, total: number): string {
  return (
    `[${batch.index}/${total}] ${batch.evalName} × ${batch.experiments.join(', ')} ` +
    `(${batch.experiments.length} cell(s) × ${batch.runs} runs = ${batch.parallel} sandboxes)`
  );
}

function printPlan(resolved: ResolvedRunPlan, cells: CellPlan[], batches: PlanBatch[]): void {
  const { plan } = resolved;
  const outstanding = cells.filter((cell) => cell.deficit > 0);
  const toCollect = outstanding.reduce((total, cell) => total + cell.deficit, 0);
  const alreadyHave = cells.reduce((total, cell) => total + cell.qualifying, 0);

  console.log(
    `Plan: ${resolved.experiments.length} experiment(s) × ${resolved.evals.length} eval(s) ` +
      `× ${plan.runs} run(s) = ${cells.length} cells, ${cells.length * plan.runs} runs.`
  );
  if (plan.force) {
    console.log('force: collecting the full target for every cell, ignoring what is on disk.');
  } else if (plan.since !== null) {
    console.log(`since ${plan.since.toISOString()}: earlier runs do not count towards a target.`);
  }
  if (plan.ackFailures) {
    console.log('ackFailures: infra and timeout runs are kept as final results.');
  }

  console.log('');
  for (const evalName of resolved.evals) {
    console.log(`  ${outStyle.bold(evalName)}`);
    for (const cell of cells.filter((candidate) => candidate.evalName === evalName)) {
      // results:compare's palette: green when nothing is left to do, red
      // when collection is needed. Padded before styling, so ANSI escapes
      // never skew the column.
      const state =
        cell.deficit === 0
          ? outStyle.tone('good', `complete (${cell.qualifying}/${cell.target})`)
          : outStyle.tone('action', `collect ${cell.deficit} — ${explainDeficit(cell, outStyle)}`);
      console.log(`    ${outStyle.caseName(cell.experiment.padEnd(42))} ${state}`);
    }
  }

  console.log(
    `\n  ${alreadyHave} run(s) already qualify; ${toCollect} to collect across ` +
      `${outstanding.length} cell(s), in ${batches.length} batch(es) of at most ` +
      `${plan.parallelMax} sandboxes.\n`
  );
  for (const batch of batches) {
    console.log(`  ${describeBatch(batch, batches.length)}`);
  }
  console.log('');
}

type StopReason = 'resource' | 'interrupt';

interface PlanReport {
  startedAt: string;
  completedAt: string;
  config: string;
  plan: Omit<ResolvedRunPlan['plan'], 'since'> & { since: string | null };
  /** What every pair already had and what the plan asked for. */
  cells: CellPlan[];
  batches: BatchOutcome[];
  gaps: CellOutcome[];
  stoppedAt: number | null;
  stoppedBy: StopReason | null;
  recommendedParallelMax: number | null;
}

function printReport(report: PlanReport, totalBatches: number): void {
  const { batches, gaps } = report;
  console.log('\n' + '─'.repeat(72));
  console.log(outStyle.bold('run-plan summary') + '\n');

  for (const outcome of batches) {
    const label = `[${outcome.batch.index}/${totalBatches}] ${outcome.batch.evalName}`;
    if (outcome.error !== undefined) {
      console.log(
        `  ${label}  ${outStyle.tone('action', `ERROR — ${outcome.error.split('\n')[0]}`)}`
      );
      continue;
    }
    const collected = collectedRuns(outcome);
    const expected = expectedRuns(outcome);
    const state =
      collected === expected
        ? outStyle.tone('good', 'ok')
        : outStyle.tone('action', `GAP ${expected - collected} run(s)`);
    console.log(
      `  ${label}  ${collected}/${expected} runs  ${formatDuration(outcome.durationMs)}  ${state}`
    );
  }

  const totalCollected = batches.reduce((sum, outcome) => sum + collectedRuns(outcome), 0);
  const totalExpected = batches.reduce((sum, outcome) => sum + expectedRuns(outcome), 0);
  const reused = report.cells.reduce((sum, cell) => sum + cell.qualifying, 0);
  console.log(
    `\n  Collected ${totalCollected}/${totalExpected} requested runs, on top of ${reused} ` +
      `that already qualified.`
  );

  if (gaps.length > 0) {
    console.log(outStyle.bold(`\n  Gaps (${gaps.length} cell(s) short of what was requested):`));
    for (const cell of gaps) {
      console.log(
        `    ${cell.evalName} × ${outStyle.caseName(cell.experiment)}  ${cell.collected}/${cell.expected} runs`
      );
      console.log(`      ${topUpCommand(cell)}`);
    }
    console.log(
      '\n  A shortfall means the classifier removed infra or timeout runs, or the batch died\n' +
        '  before saving. Re-running the plan collects the difference on its own; the\n' +
        '  commands above do it one cell at a time.'
    );
  }

  const signals = batches.flatMap((outcome) =>
    outcome.signals.map((signal) => ({ batch: outcome.batch.index, signal }))
  );
  if (signals.length > 0) {
    console.log(outStyle.bold('\n  Resource signals:'));
    for (const { batch, signal } of signals) {
      console.log(
        `    batch ${batch}  ${outStyle.tone('caution', signal.kind)}: ${signal.evidence}`
      );
    }
  }

  if (report.recommendedParallelMax !== null) {
    console.log(
      `\n  Memory pressure was observed. Set parallelMax: ${report.recommendedParallelMax} ` +
        `in the plan config for future runs.`
    );
  } else if (signals.some(({ signal }) => signal.kind === 'memory')) {
    console.log(
      `\n  Memory pressure was observed, but parallelMax is already at one cell ` +
        `(${report.plan.runs} sandboxes). Lower runs to shrink batches further.`
    );
  }

  if (report.stoppedAt !== null) {
    const why =
      report.stoppedBy === 'interrupt'
        ? 'interrupted'
        : 'the remaining batches would fail the same way';
    console.log(
      `\n  Plan stopped after batch ${report.stoppedAt} of ${totalBatches} (${why}).\n` +
        '  Re-run the same config to continue — collected runs count towards their targets.'
    );
  }

  console.log('─'.repeat(72));
}

function writeReport(report: PlanReport): string {
  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = report.startedAt.replace(/[:.]/g, '-');
  const path = join(RESULTS_DIR, `run-plan-${stamp}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  return path;
}

// A batch that starts the moment its account balance crosses the reload
// floor can fail on calls the reload would have covered seconds later, so
// consecutive batches are spaced apart.
const INTER_BATCH_WAIT_MS = 90_000;

// Sliced so Ctrl-C during the pause is honored within a few seconds.
async function interruptibleSleep(totalMs: number): Promise<void> {
  const SLICE_MS = 5_000;
  for (let waited = 0; waited < totalMs && !interrupted; waited += SLICE_MS) {
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(SLICE_MS, totalMs - waited))
    );
  }
}

// Ctrl-C stops the plan between batches so collected batches still get
// their report. A second Ctrl-C exits immediately.
let interrupted = false;

function watchForInterrupt(): void {
  process.on('SIGINT', () => {
    if (interrupted) {
      console.error('\nrun-plan: interrupted again — exiting without a report.');
      process.exit(130);
    }
    interrupted = true;
    console.error('\nrun-plan: interrupted — finishing the current batch, then reporting.');
  });
}

async function main(): Promise<void> {
  const flags = selectionFlags(process.env);
  const argv = flags
    .parser(
      process.argv.slice(2),
      {
        scriptName: 'eval:plan',
        usage: 'Usage: yarn workspace agent-eval run eval:plan --plan <name-or-path> [--dry]',
      },
      {
        config: {
          ...flags.text('config', 'Plan config, by name or path (default plans/default.plan.ts)'),
          alias: ['plan'],
        },
        dry: flags.switch('dry', 'Print what would be collected and spend nothing'),
      }
    )
    .parseSync();

  const configArg = argv.config ?? DEFAULT_CONFIG;
  const configPath = resolvePlanPath(configArg);
  const plan = await loadPlanConfig(configPath);

  const resolved = resolveRunPlan(plan, {
    experiments: knownExperimentNames(),
    evals: AGENTIC_REF_EVAL_REGISTRY,
  });

  const cells = planCells(resolved);
  const batches = planBatches(cells, resolved.evals, resolved.plan.parallelMax);

  console.log(`Config: ${relative(AGENT_EVAL_ROOT, configPath)}`);
  printPlan(resolved, cells, batches);

  if (argv.dry) {
    return;
  }
  if (batches.length === 0) {
    console.log(
      outStyle.tone('good', 'Nothing to collect: every cell already has its full sample.')
    );
    return;
  }

  watchForInterrupt();

  const startedAt = new Date().toISOString();
  const outcomes: BatchOutcome[] = [];
  let stoppedAt: number | null = null;
  let stoppedBy: StopReason | null = null;

  for (const batch of batches) {
    console.log(`\n${outStyle.bold(describeBatch(batch, batches.length))}`);

    let outcome: BatchOutcome;
    try {
      outcome = await runBatch(batch, resolved);
    } catch (error) {
      outcome = {
        batch,
        cells: [],
        exitCode: null,
        durationMs: 0,
        signals: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
    outcomes.push(outcome);

    if (outcome.error !== undefined) {
      console.error(errStyle.tone('action', `  batch failed to run: ${outcome.error}`));
    }

    const stopping = outcome.signals.find(isPlanStoppingSignal);
    if (stopping !== undefined) {
      console.error(
        errStyle.tone(
          'action',
          `\n  ${stopping.kind} exhaustion — stopping the plan: ${stopping.evidence}`
        )
      );
      stoppedAt = batch.index;
      stoppedBy = 'resource';
      break;
    }

    if (interrupted) {
      stoppedAt = batch.index;
      stoppedBy = 'interrupt';
      break;
    }

    if (batch.index < batches.length) {
      console.log(outStyle.dim(`  pausing ${INTER_BATCH_WAIT_MS / 1000}s before the next batch`));
      await interruptibleSleep(INTER_BATCH_WAIT_MS);
      if (interrupted) {
        stoppedAt = batch.index;
        stoppedBy = 'interrupt';
        break;
      }
    }
  }

  const gaps = outcomes
    .flatMap((outcome) => outcome.cells)
    .filter((cell) => cell.collected < cell.expected);

  const sawMemoryPressure = outcomes.some((outcome) =>
    outcome.signals.some((signal) => signal.kind === 'memory')
  );

  const report: PlanReport = {
    startedAt,
    completedAt: new Date().toISOString(),
    config: relative(AGENT_EVAL_ROOT, configPath),
    plan: {
      ...resolved.plan,
      since: resolved.plan.since?.toISOString() ?? null,
    },
    cells,
    batches: outcomes,
    gaps,
    stoppedAt,
    stoppedBy,
    recommendedParallelMax: sawMemoryPressure
      ? narrowedParallelMax(resolved.plan.parallelMax, resolved.plan.runs)
      : null,
  };

  printReport(report, batches.length);
  console.log(`\nReport: ${relative(AGENT_EVAL_ROOT, writeReport(report))}`);

  // Non-zero on an incomplete sample only; ordinary eval failures are data.
  const incomplete =
    gaps.length > 0 ||
    stoppedAt !== null ||
    outcomes.some((outcome) => outcome.error !== undefined);
  process.exit(incomplete ? 1 : 0);
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
