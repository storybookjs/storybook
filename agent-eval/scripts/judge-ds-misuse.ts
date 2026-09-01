#!/usr/bin/env node
// LLM-judged design-system misuse over stored eval runs.
//
// Unlike scripts/analyze-results.ts, this is NOT free: it makes one model call
// per run. That is the whole reason it is a separate command — analyze-results
// documents that every metric it computes is a pure function of stored
// artifacts, re-runnable as often as a definition changes without spending
// anything, and calling a paid API from it would end that guarantee.
//
// Each run's judgement is cached in its own directory as ds-misuse.json and
// reused until the guidelines pin or the metrics version moves.
//
// The package script runs this under `node --env-file-if-exists=.env.local`.
// Every other entry point into this suite goes through the agent-eval binary,
// which loads .env.local itself; a plain `node scripts/...` is the odd one out,
// and without the flag the ANTHROPIC_API_KEY abort would name a fix — "add it to
// .env.local" — that does not actually work. The -if-exists form is deliberate:
// plain --env-file is fatal when the file is absent, which would break every
// invocation by anyone who exports the key instead.
//
// --dry settles everything that can be settled locally (pin, DS packages, cache
// freshness, node census) and prints which runs it would judge, reuse or skip.
//
// Usage: yarn workspace agent-eval run judge:ds-misuse [flags]. Run with --help for the flag list.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { AGENTIC_REF_EVAL_REGISTRY, knownExperimentNames } from '#lib/agentic-reference/cases';
import { isCurrentRun } from '#lib/agentic-reference/comparability';
import {
  type ExternalRepoPin,
  prepareRef,
  typecheckExternalRepo,
} from '#lib/agentic-reference/external-repo';
import { laterSince, resolvePlanFlag } from '#lib/agentic-reference/plan-config';
import { dsPackagesForPin } from '#lib/agentic-reference/metrics/coverage';
import { dsDocsRefLabel } from '#lib/agentic-reference/metrics/ds-misuse/ds-docs';
import {
  isStale,
  judgeRun,
  readMisuseReport,
  writeMisuseReport,
} from '#lib/agentic-reference/metrics/ds-misuse/index';
import { assertApiKey } from '#lib/agentic-reference/metrics/ds-misuse/judge';
import { addUsage, usdOf } from '#lib/agentic-reference/metrics/judge-utils';
import { postAnalysis } from '#lib/agentic-reference/post-analysis';
import { readNodeCensus } from '#lib/post-analysis/baseline';
import { findRuns, selectRuns, type Run, type RunSelection } from '#lib/post-analysis/discovery';
import { selectionFlags } from '#lib/agentic-reference/selection';
import { formatCompactCount, shortExperiment } from '#lib/agentic-reference/utils';
import { bold, dim, red, yellow } from '@storybook/scripts-utils/colors.ts';
import { readJson } from '#lib/utils/files';
import { isRecord } from '#lib/utils/type';

import type { JudgeUsage } from '#lib/agentic-reference/metrics/ds-misuse/judge';
import type { NodeRecord } from '#lib/agentic-reference/metrics/ds-coverage/types';

/** A mean score at terminal width: bare when clean, colored as it degrades. */
function score(value: number | null): string {
  if (value === null) return dim('   —');
  const text = value.toFixed(3);
  if (value < 0.75) return red(text);
  if (value < 0.9) return yellow(text);
  return text;
}

function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, '0')}s`;
}

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RESULTS_DIR = join(ROOT, 'results');
const BASELINES_DIR = join(ROOT, 'baselines');
const REF_CACHE_DIR = join(ROOT, '.eval-cache/refs');

// Selection is the shared agentic-reference grammar, not a private one: this
// command spends money per run, and `--experiments`/`--evals` is how a sweep is
// narrowed to the arm under review. A second dialect here would mean the flags
// that scope a paid run read differently from the ones that scope the free
// analysis pass over the same directories.
interface Options extends RunSelection {
  plan: string | undefined;
  recompute: boolean;
  dry: boolean;
}

function parseOptions(argv: string[]): Options {
  const flags = selectionFlags(process.env);
  const parsed = flags
    .parser(
      argv,
      {
        scriptName: 'judge:ds-misuse',
        usage: 'Usage: yarn workspace agent-eval run judge:ds-misuse [flags]',
      },
      {
        experiments: flags.experiments,
        evals: flags.evals,
        plan: flags.text('plan', "Judge a collection plan's cells (plans/<name>.plan.ts)"),
        since: flags.text('since', 'Only runs stamped on or after this ISO date'),
        latest: flags.switch('latest', 'Only the newest result directory per experiment'),
        dry: flags.switch('dry', 'Print the plan and spend nothing'),
        recompute: {
          ...flags.switch('recompute', 'Re-judge runs that already carry a ds-misuse.json'),
          alias: ['force'],
        },
      }
    )
    .parseSync();

  return {
    experiments: parsed.experiments,
    evals: parsed.evals,
    plan: parsed.plan,
    since: parsed.since ?? null,
    latest: parsed.latest,
    dry: parsed.dry,
    recompute: parsed.recompute,
  };
}

/**
 * Scope the selection to one collection plan's cells, exactly as
 * results:compare reads the same flag — so the runs a plan's comparison
 * tables stand on are the runs this command judges, and a bundle never mixes
 * judged and unjudged cells because the two commands were scoped by hand
 * twice. The plan's own `since` applies, narrowed further by --since when
 * that CLI date is the later of the two.
 */
async function applyPlanScope(options: Options): Promise<Options> {
  const resolved = await resolvePlanFlag(
    options,
    { experiments: knownExperimentNames(), evals: AGENTIC_REF_EVAL_REGISTRY },
    '--experiments/--evals'
  );
  if (resolved === null) {
    return options;
  }
  return {
    ...options,
    experiments: [...resolved.experiments],
    evals: [...resolved.evals],
    since: laterSince(options.since, resolved.plan.since),
  };
}

/** The pin the run itself recorded — never today's fixture pin. */
function pinOf(runDir: string) {
  const result = readJson(join(runDir, 'result.json'));
  const analysis = isRecord(result) && isRecord(result.analysis) ? result.analysis : {};
  try {
    return typecheckExternalRepo(analysis.externalRepo);
  } catch {
    return null;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function labelOf(run: Run): string {
  return `${run.experiment}/${run.timestamp}/${run.evalName}/run-${run.run}`;
}

type Plan =
  | { action: 'reused' | 'skipped' }
  | {
      action: 'judge';
      pin: ExternalRepoPin;
      fixtureRef: string;
      dsPackages: string[];
      baselineNodes: NodeRecord[];
    };

/**
 * Everything a run needs before anything is spent on it, and whether it has it.
 *
 * Kept separate from the call it precedes so --dry can reach the same verdicts
 * for free: the checks below are the ones that decide whether a run is worth
 * paying for, so a plan that skipped any of them would not be the plan.
 */
function planRun(run: Run, options: Options): Plan {
  const label = labelOf(run);

  const pin = pinOf(run.runDir);
  if (pin === null) {
    console.error(`${label}: recorded no usable evals.externalRepo pin, so it has no baseline.`);
    return { action: 'skipped' };
  }
  const fixtureRef = `${pin.repo}@${pin.ref}`;

  const dsPackages = dsPackagesForPin(pin);
  if (dsPackages === null) {
    console.error(
      `${label}: ${fixtureRef} declares no DS packages. ` +
        'Add it to DS_PACKAGES_BY_PIN in lib/agentic-reference/metrics/coverage.ts.'
    );
    return { action: 'skipped' };
  }

  const existing = options.recompute ? null : readMisuseReport(run.runDir);
  if (existing && !isStale(existing, { dsGuidelinesRef: dsDocsRefLabel() })) {
    return { action: 'reused' };
  }

  const baselineNodes = readNodeCensus(BASELINES_DIR, pin, postAnalysis.metricsVersion);
  if (baselineNodes === null) {
    console.error(
      `${label}: no node census for ${fixtureRef} at metricsVersion ` +
        `${postAnalysis.metricsVersion ?? 'none'}. Run: yarn workspace agent-eval run results:analyze --recompute`
    );
    return { action: 'skipped' };
  }

  return { action: 'judge', pin, fixtureRef, dsPackages, baselineNodes };
}

/** Judge one run, or explain why it cannot be judged. */
async function judgeOne(
  run: Run,
  options: Options,
  spent: JudgeUsage,
  progress: { done: number; total: number },
  beforeLine: () => void
): Promise<'judged' | 'reused' | 'skipped'> {
  const plan = planRun(run, options);
  if (plan.action !== 'judge') {
    return plan.action;
  }

  // Checked once the cheap local work has had its chance to fail.
  assertApiKey();

  const startedAt = Date.now();
  const { report, usage } = await judgeRun({
    runDir: run.runDir,
    projectDir: run.projectDir,
    baselineDir: prepareRef(REF_CACHE_DIR, plan.pin.repo, plan.pin.ref),
    baselineNodes: plan.baselineNodes,
    dsPackages: plan.dsPackages,
    fixtureRef: plan.fixtureRef,
    metricsVersion: postAnalysis.metricsVersion,
    refCacheDir: REF_CACHE_DIR,
  });
  writeMisuseReport(run.runDir, report);
  addUsage(spent, usage);

  const { correctDsDecision, correctDsUsage, correctLocalDecision, evaluated } = report.summary;
  beforeLine();
  const counter = `[${String(progress.done + 1).padStart(String(progress.total).length)}/${progress.total}]`;
  console.log(
    `  ${dim(counter)} run-${String(run.run).padEnd(2)} ` +
      `${String(evaluated.ds).padStart(2)} DS · ${String(evaluated.local).padStart(2)} local   ` +
      `decision ${score(correctDsDecision)}  usage ${score(correctDsUsage)}  local ${score(correctLocalDecision)}` +
      dim(`   $${usdOf(usage).toFixed(2)} · ${duration(Date.now() - startedAt)}`)
  );
  return 'judged';
}

/**
 * Print what a real pass would do, and spend nothing doing it.
 *
 * A cell tells the whole story in one line — a paid command's plan is read to
 * answer "how many calls, where", and a run-per-line listing buries that under
 * its own labels. Every judged run still prints individually in the real pass.
 */
function dryRun(runs: Run[], options: Options): void {
  const cells = new Map<string, { judge: number; reused: number; skipped: number }>();
  const counts = { judge: 0, reused: 0, skipped: 0 };
  for (const run of runs) {
    const plan = planRun(run, options);
    counts[plan.action] += 1;
    const key = `${shortExperiment(run.experiment)} · ${run.evalName}`;
    const cell = cells.get(key) ?? { judge: 0, reused: 0, skipped: 0 };
    cell[plan.action === 'judge' ? 'judge' : plan.action] += 1;
    cells.set(key, cell);
  }

  console.log(`Dry run against ${bold(dsDocsRefLabel())} — nothing spent.\n`);
  const width = Math.max(...[...cells.keys()].map((key) => key.length));
  for (const [key, cell] of cells) {
    const notes = [
      cell.judge > 0 ? `${bold(String(cell.judge))} to judge` : '',
      cell.reused > 0 ? dim(`${cell.reused} cached`) : '',
      cell.skipped > 0 ? yellow(`${cell.skipped} skipped`) : '',
    ].filter(Boolean);
    console.log(`  ${key.padEnd(width)}   ${notes.join(dim(' · '))}`);
  }

  console.log(
    `\nWould judge ${bold(String(counts.judge))} run(s), one model call each` +
      (counts.reused > 0 ? `; ${counts.reused} cached judgement(s) reused free` : '') +
      (counts.skipped > 0 ? `; ${counts.skipped} skipped` : '') +
      '.'
  );
  if (counts.reused > 0) console.log(dim('Pass --recompute to re-judge cached runs.'));
}

async function main() {
  const options = await applyPlanScope(parseOptions(process.argv.slice(2)));

  if (!existsSync(RESULTS_DIR)) {
    console.log('No results/ directory; nothing to judge.');
    return;
  }

  const selected = selectRuns(findRuns(RESULTS_DIR), options);
  // A run whose project tree was never collected has nothing to diff against
  // its baseline, and the judge scores a diff. Dropped here rather than left to
  // fail one by one downstream: --latest points at the newest result directory
  // per experiment, which is exactly where an interrupted sweep leaves its
  // uncollected runs, and a paid command should say "nothing to judge" before
  // it says it per run.
  const collected = selected.filter((run) => run.collected);
  const uncollected = selected.length - collected.length;
  if (uncollected > 0) {
    console.log(`Skipping ${uncollected} run(s) that left no project tree behind.`);
  }
  // A superseded run measures something its (experiment, eval) pair no longer
  // measures, and results:compare keeps such runs out of its cells (see
  // lib/agentic-reference/comparison/cells.ts) — so a judgement bought for one
  // would never reach a comparison table. Dropped here for the same reason the
  // plan scoping above exists: the runs this command judges must be the runs
  // the plan's tables stand on.
  const runs = collected.filter((run) => isCurrentRun(run.runDir, run));
  const superseded = collected.length - runs.length;
  if (superseded > 0) {
    console.log(`Skipping ${superseded} superseded run(s) whose measurement was since replaced.`);
  }
  if (runs.length === 0) {
    console.log('No runs matched.');
    return;
  }

  if (options.dry) {
    dryRun(runs, options);
    return;
  }

  console.log(`Judging up to ${runs.length} run(s) against ${bold(dsDocsRefLabel())}\n`);

  const counts = { judged: 0, reused: 0, skipped: 0, failed: 0 };
  const spent: JudgeUsage = {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
  };
  const startedAt = Date.now();
  const progress = { done: 0, total: runs.length };
  // Lazy, so a group whose runs are all cached prints nothing at all.
  let printed = '';
  for (const run of runs) {
    const heading = `${shortExperiment(run.experiment)} · ${run.evalName} · ${run.timestamp}`;
    const beforeLine = () => {
      if (heading !== printed) {
        printed = heading;
        console.log(bold(heading));
      }
    };
    try {
      counts[await judgeOne(run, options, spent, progress, beforeLine)] += 1;
    } catch (error) {
      // One broken run must not cost us the others — but an absent API key
      // will fail every remaining run identically, so stop on it.
      counts.failed += 1;
      beforeLine();
      const message = messageOf(error);
      console.error(`  ${red('failed')} run-${run.run}: ${message}`);
      if (message.includes('ANTHROPIC_API_KEY')) throw error;
    }
    progress.done += 1;
  }

  const parts = [`${bold(String(counts.judged))} judged`];
  if (counts.reused > 0) parts.push(`${counts.reused} reused`);
  if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`);
  if (counts.failed > 0) parts.push(red(`${counts.failed} failed`));
  console.log(`\n${parts.join(', ')} in ${duration(Date.now() - startedAt)}.`);
  if (counts.judged > 0) {
    console.log(
      `Spent ~$${usdOf(spent).toFixed(2)} — ` +
        `${formatCompactCount(spent.inputTokens)} in · ${formatCompactCount(spent.cacheReadTokens)} cache read · ` +
        `${formatCompactCount(spent.cacheWriteTokens)} cache write · ${formatCompactCount(spent.outputTokens)} out` +
        (counts.judged > 1 ? ` (~$${(usdOf(spent) / counts.judged).toFixed(2)}/run)` : '') +
        '.'
    );
  }
  if (counts.reused > 0) {
    console.log(dim('Cached judgements were reused free; --recompute re-judges them.'));
  }
}

main().catch((error) => {
  console.error(messageOf(error));
  process.exit(1);
});
