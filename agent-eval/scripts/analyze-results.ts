#!/usr/bin/env node
// Offline metrics pass over stored eval runs. It discovers run directories
// and hands each run to the module its *experiment* names in `postAnalysis`
// (see lib/post-analysis/types.ts); runs whose experiment names none are
// skipped. Keying on the experiment rather than the eval lets a family of
// experiments sharing a task and setup share one set of metrics, and lets
// one experiment span several evals.
//
// A sample of one experiment/eval pair spans several result directories,
// since a plan tops it up over more than one invocation. Tables fold per
// comparable set instead of per directory (see
// lib/agentic-reference/comparability.ts). Superseded groups print only
// with --superseded. Each directory's own summary.json still describes
// only its own runs.
//
// Every metric is a pure function of stored artifacts, so this can be
// re-run any time a metric definition changes, at no cost in model calls.
// Results are cached per run in post-analysis-meta.json; pass --recompute
// to force recomputation. Every comparable set's rows also land in
// results/analysis-summary.json, for a single-read comparison across
// experiments.
//
// A module measuring against a pristine upstream tree also provides
// deltaToBaseline: this script analyzes the pinned tree once per pin, in
// `baseline` mode, commits the result under baselines/, and passes both
// sets of numbers to deltaToBaseline.
//
// Usage: yarn results:analyze [--experiments <list>] [--evals <list>] [--since <ISO date>]
//                             [--latest] [--recompute] [--superseded]
//                             [--general] [--complexity] [--coverage]
//
//   --experiments <list>  only runs under results/<name>/, by name or glob
//   --evals <list>        only runs of these evals, by name, number (706) or glob
//   --since <ISO date>    only runs whose result directory is stamped on or after
//   --latest              only the newest result directory per experiment
//   --recompute           recompute analysis, and rebuild committed baselines,
//                         even where a cached result exists (alias: --force)
//   --superseded          also print the groups measuring something their cell
//                         no longer measures, and what moved under each
//   --general             print the per-run vitals and grouped summary tables
//   --complexity          print the complexity tables
//   --coverage            print the design-system coverage tables
//   --misuse             print the design-system misuse tables (see judge:ds-misuse)
//
// Selection follows the shared grammar in lib/agentic-reference/selection.ts,
// with each flag falling back to AGENTIC_REF_<FLAG>. --recompute reads
// AGENTIC_REF_RECOMPUTE; its --force alias stays command-line only, so an
// AGENTIC_REF_FORCE exported to re-run a case does not also rebuild baselines.
//
// The three table flags select what is printed; everything is measured and
// written either way. Passing any of them prints exactly that set; passing
// none falls back to DEFAULT_TABLES below.
import { styleText } from 'node:util';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describeStoredRun, groupComparableRuns } from '#lib/agentic-reference/comparability';
import {
  currentMeasurement,
  describeDifferences,
  measurementDifferences,
} from '#lib/agentic-reference/identity';
import { typecheckExternalRepo } from '#lib/agentic-reference/external-repo';
import { readMisuseReport } from '#lib/agentic-reference/metrics/ds-misuse/index';
import { loadOrBuildBaselineAnalysis } from '#lib/post-analysis/baseline';
import { findRuns, selectRuns, type Run } from '#lib/post-analysis/discovery';
import { postAnalysisFrom } from '#lib/post-analysis/hooks';
import { isCurrentCacheEntry, readCacheEntry, writeCacheEntry } from '#lib/post-analysis/run-cache';
import { mergeIntoEvalSummary } from '#lib/post-analysis/summary';
import { isRecord } from '#lib/utils/type';
import { readJson } from '#lib/utils/files';
import { selectionFlags } from '#lib/agentic-reference/selection';

import type { ComparableGroup } from '#lib/agentic-reference/comparability';
import type {
  Analysis,
  PostAnalysis,
  RunContext,
  SummarizeOptions,
} from '#lib/post-analysis/types';
import { EVALS_DIR, experimentDefinition, RESULTS_DIR } from '#lib/agentic-reference/constants';

// --- options ---
const TABLE_SECTIONS = ['general', 'complexity', 'coverage', 'misuse'] as const;
type TableSection = (typeof TABLE_SECTIONS)[number];

// What prints when no table flag is passed: coverage alone, since the other
// two families push it off the bottom of a terminal.
const DEFAULT_TABLES: TableSection[] = ['coverage'];

interface PostAnalysisOptions {
  experiments: string[];
  evals: string[];
  since: string | null;
  latest: boolean;
  recompute: boolean;
  superseded: boolean;
  tables: SummarizeOptions;
}

function parseOptions(argv: string[]): PostAnalysisOptions {
  const flags = selectionFlags(process.env);
  const parsed = flags
    .parser(
      argv,
      {
        scriptName: 'results:analyze',
        usage: 'Usage: yarn results:analyze [flags]',
      },
      {
        experiments: flags.experiments,
        evals: flags.evals,
        since: flags.text('since', 'Only runs stamped on or after this ISO date'),
        latest: flags.switch('latest', 'Only the newest result directory per experiment'),
        recompute: {
          ...flags.switch(
            'recompute',
            'Recompute analysis and baselines even where a cached result exists'
          ),
          alias: ['force'],
        },
        superseded: flags.switch(
          'superseded',
          'Also print groups collected under a configuration since replaced'
        ),
        general: flags.switch('general', 'Print the per-run vitals and grouped summary tables'),
        complexity: flags.switch('complexity', 'Print the complexity tables'),
        coverage: flags.switch('coverage', 'Print the design-system coverage tables'),
        misuse: flags.switch('misuse', 'Print the design-system misuse tables'),
      }
    )
    .parseSync();

  const sections = TABLE_SECTIONS.filter((section) => parsed[section] === true);
  // Naming any section selects exactly that set, not the default plus it.
  const chosen = sections.length === 0 ? DEFAULT_TABLES : sections;

  return {
    experiments: parsed.experiments,
    evals: parsed.evals,
    since: parsed.since ?? null,
    latest: parsed.latest === true,
    recompute: parsed.recompute === true,
    superseded: parsed.superseded === true,
    tables: {
      general: chosen.includes('general'),
      complexity: chosen.includes('complexity'),
      coverage: chosen.includes('coverage'),
      misuse: chosen.includes('misuse'),
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// --- post-analysis loading ---
// Which module analyses a run is the experiment's call, not the eval's.
// Experiments sharing a module share it by reference, grouping their runs
// into a single summary.
const byExperiment = new Map<string, PostAnalysis | null>();

async function loadPostAnalysis(
  experiment: string,
  failures: string[]
): Promise<PostAnalysis | null> {
  const cached = byExperiment.get(experiment);
  if (cached !== undefined) return cached;

  // Agentic-reference experiments generate their definitions under
  // .agentic-ref/experiments/ rather than experiments/.
  const definition = experimentDefinition(experiment);
  // A renamed or deleted experiment leaves its runs on disk; skipped, not fatal.
  let postAnalysis: PostAnalysis | null = null;
  if (definition) {
    try {
      postAnalysis = postAnalysisFrom(await import(pathToFileURL(definition).href), experiment);
    } catch (error) {
      failures.push(`experiments/${experiment}.ts: ${messageOf(error)}`);
    }
  }

  byExperiment.set(experiment, postAnalysis);
  return postAnalysis;
}

// --- per-run analysis ---
// The pin the run itself recorded, not the fixture's current pin, so a
// historical delta does not change retroactively when the fixture moves.
function pinOf(result: unknown) {
  const analysis = isRecord(result) && isRecord(result.analysis) ? result.analysis : {};
  try {
    return typecheckExternalRepo(analysis.externalRepo);
  } catch {
    return null;
  }
}

async function analyzeOneRun(
  run: Run,
  postAnalysis: PostAnalysis,
  options: PostAnalysisOptions
): Promise<Analysis | null> {
  const transcript = readJson<unknown>(join(run.runDir, 'transcript.json'));
  if (!transcript) {
    throw new Error('transcript.json missing or unreadable');
  }

  const result = readJson(join(run.runDir, 'result.json'));
  const context: RunContext = {
    mode: 'run',
    runDir: run.runDir,
    projectDir: run.projectDir,
    fixtureDir: join(EVALS_DIR, run.evalName),
    experiment: run.experiment,
    model: run.model,
    timestamp: run.timestamp,
    evalName: run.evalName,
    run: run.run,
    result,
    transcript,
    pin: pinOf(result),
  };

  const runAnalysis = await postAnalysis.analyzeRun(context);
  if (runAnalysis === null || postAnalysis.deltaToBaseline === undefined) {
    return runAnalysis;
  }

  const { pin } = context;
  if (pin === null) {
    throw new Error(
      'run recorded no usable evals.externalRepo pin, so there is no baseline to compare it against'
    );
  }

  const baseline = await loadOrBuildBaselineAnalysis({
    pin,
    postAnalysis,
    recompute: options.recompute,
  });

  return {
    ...runAnalysis,
    deltaToBaseline: await postAnalysis.deltaToBaseline({
      ...context,
      pin,
      runAnalysis,
      baselineDir: baseline.dir,
      baselineAnalysis: baseline.analysis,
    }),
  };
}

// --- entry point ---
interface SuccessfulAnalysis extends Record<string, unknown> {
  __run: Run;
  __postAnalysis: PostAnalysis;
}
// Internal routing state, stripped before anything sees a record.
//
// Read fresh on every invocation and merged here rather than into the cached
// analysis: the judge runs after this script, so a cached row would never gain
// the scores without --recompute.
function strip(row: SuccessfulAnalysis): Record<string, unknown> {
  const report = readMisuseReport(row.__run.runDir);
  return {
    ...Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== '__run' && key !== '__postAnalysis')
    ),
    ...(report === null ? {} : { dsMisuse: report }),
  };
}

/** A comparable set's heading: which experiment, which eval, which generation. */
function heading(group: ComparableGroup<SuccessfulAnalysis>): string {
  const arm = [group.experiment, group.model].filter((part) => part !== '').join('/');
  const cell = `${arm} · ${group.evalName}`;
  return group.current ? cell : `${cell}  (superseded)`;
}

/** What a superseded group's pair no longer measures. */
function supersessionNote(group: ComparableGroup<SuccessfulAnalysis>): string {
  const current = currentMeasurement(group.experiment, group.evalName);
  if (group.measurement === null) {
    return 'these runs recorded no measurement.';
  }
  if (current === null) {
    return 'this arm or eval no longer exists.';
  }
  return describeDifferences(measurementDifferences(group.measurement, current));
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const selected = selectRuns(findRuns(RESULTS_DIR), options);
  const runs = selected.filter((run) => run.collected);
  const incomplete = selected.length - runs.length;

  const successfulAnalyses: SuccessfulAnalysis[] = [];
  const failedAnalyses: string[] = [];
  let withoutHook = 0;
  let reused = 0;

  for (const run of runs) {
    // The experiment names the module that analyses its runs; if it names
    // none, this run is not ours to measure.
    const postAnalysis = await loadPostAnalysis(run.experiment, failedAnalyses);
    if (postAnalysis === null) {
      withoutHook += 1;
      continue;
    }

    // Fetch cached post analysis output unless --recompute was passed. A stale
    // or unstamped entry (older metrics code) counts as a miss.
    const entry = options.recompute ? null : readCacheEntry(run.runDir);
    const cached = isCurrentCacheEntry(entry, postAnalysis.metricsVersion) ? entry : null;
    if (cached) {
      reused += 1;
      if (cached.output) {
        // Cache and artifact must not diverge: a hit re-emits a missing analysis.json.
        const analysisPath = join(run.runDir, 'analysis.json');
        if (!existsSync(analysisPath)) {
          writeFileSync(analysisPath, JSON.stringify(cached.output, null, 2) + '\n');
        }
        successfulAnalyses.push({
          ...cached.output,
          __run: run,
          __postAnalysis: postAnalysis,
        });
      }
      continue;
    }

    try {
      const analysisOutput = await analyzeOneRun(run, postAnalysis, options);
      if (analysisOutput) {
        writeFileSync(
          join(run.runDir, 'analysis.json'),
          JSON.stringify(analysisOutput, null, 2) + '\n'
        );
      }
      writeCacheEntry(run.runDir, analysisOutput ?? null, postAnalysis.metricsVersion);
      if (analysisOutput) {
        successfulAnalyses.push({
          ...analysisOutput,
          __run: run,
          __postAnalysis: postAnalysis,
        });
      }
    } catch (error) {
      failedAnalyses.push(`${run.evalName} run-${run.run}: ${messageOf(error)}`);
    }
  }

  if (incomplete > 0) {
    console.log(
      styleText(
        'yellow',
        `Skipped ${incomplete} run director${incomplete === 1 ? 'y' : 'ies'} holding no project ` +
          'tree: those runs stopped on billing, a timeout or another infra failure. ' +
          'Run `yarn results:prune` to see and clear them.'
      )
    );
  }
  if (withoutHook > 0) {
    console.log(
      `Skipped ${withoutHook} ${
        withoutHook === 1 ? 'run' : 'runs'
      } whose experiment carries no postAnalysis.`
    );
  }
  if (reused > 0) {
    console.log(`Reused cached analysis for ${reused} run(s); pass --recompute to recompute.`);
  }
  for (const message of failedAnalyses) console.error(`Analysis failed for ${message}`);

  if (successfulAnalyses.length === 0) {
    console.log('No analysable runs found under results/.');
    return;
  }

  successfulAnalyses.sort(
    (a, b) =>
      String(a.__run.experiment).localeCompare(String(b.__run.experiment)) ||
      String(a.__run.timestamp).localeCompare(String(b.__run.timestamp)) ||
      a.__run.run - b.__run.run
  );

  // A silently absent metric is the failure mode worth shouting about, so this
  // fires whichever table families were selected.
  const unjudged = successfulAnalyses.filter(
    (row) => readMisuseReport(row.__run.runDir) === null
  ).length;
  if (unjudged > 0) {
    console.error(
      `\n${styleText('bold', styleText('red', `No ds-misuse judgement for ${unjudged} of ${successfulAnalyses.length} run(s).`))}\n` +
        '  Run: yarn judge:ds-misuse' +
        (options.experiments.length ? ` --experiments=${options.experiments.join(',')}` : '') +
        (options.latest ? ' --latest' : '')
    );
  }

  // Grouped by the directory holding the run-* dirs, i.e. one group per eval of
  // one experiment at one timestamp. That is the unit summary.json describes,
  // so summarize is scoped to it and every run in a group shares one module.
  const byEvalDir = new Map<string, SuccessfulAnalysis[]>();
  for (const row of successfulAnalyses) {
    const evalDir = dirname(row.__run.runDir);
    const list = byEvalDir.get(evalDir) ?? [];
    list.push(row);
    byEvalDir.set(evalDir, list);
  }
  for (const [evalDir, analyses] of byEvalDir) {
    const rows = analyses[0]!.__postAnalysis.summarize(analyses.map(strip), {
      ...options.tables,
      quiet: true,
    });
    mergeIntoEvalSummary(evalDir, rows);
  }

  const groups = groupComparableRuns(successfulAnalyses, (row) => {
    const { experiment, evalName, model, runDir } = row.__run;
    return { experiment, model, evalName, ...describeStoredRun(runDir, { experiment, evalName }) };
  });

  // Superseded groups are the measurement a pair used to make, kept apart so
  // they are not averaged into the one it makes now. They are folded and
  // stored either way, and only print on request.
  let hidden = 0;
  const summary: Analysis[] = [];

  for (const group of groups) {
    const show = options.superseded || group.current;
    if (show) {
      console.log(
        `\n${styleText('dim', '===')}  ${styleText('bold', styleText('cyan', heading(group)))}  ${styleText('dim', '===')}\n`
      );
      if (!group.current) {
        console.log(`  superseded — ${supersessionNote(group)}\n`);
      }
    } else {
      hidden += 1;
    }

    // Every run of a comparable set is one experiment's, so they share one module.
    const rows = group.members[0]!.__postAnalysis.summarize(group.members.map(strip), {
      ...options.tables,
      quiet: !show,
    });
    summary.push(
      ...rows.map((row) => ({
        ...row,
        measurement: group.measurement,
        current: group.current,
      }))
    );
  }

  if (hidden > 0) {
    const runs = groups
      .filter((group) => !group.current)
      .reduce((total, group) => total + group.members.length, 0);
    console.log(
      `\nHid ${hidden} superseded group(s) holding ${runs} run(s), measuring something their ` +
        'cell no longer measures. They are still in analysis-summary.json, marked ' +
        '`current: false`. Pass --superseded to print them, with what moved under each.'
    );
  }

  // Every matched run in one file, so comparing experiments is a single read.
  writeFileSync(
    join(RESULTS_DIR, 'analysis-summary.json'),
    JSON.stringify({ runs: successfulAnalyses.map(strip), summary }, null, 2) + '\n'
  );
}

main().catch((error) => {
  console.error(messageOf(error));
  process.exit(1);
});
