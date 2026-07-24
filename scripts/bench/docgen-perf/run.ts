/**
 * Orchestrator for the per-engine docgen performance suite. Implements the measurement contract in
 * scripts/bench/PERF-METHODOLOGY.md: five floor metrics per engine, plain Node, fresh child process
 * per measurement, median-of-N with one pinned N recorded in the results.
 *
 * Topology per engine:
 *   - Cold medians come from N fresh spawns; warm is the median of the per-save durations inside
 *     the first repetition's save series; memory metrics also read the first repetition.
 *   - react-legacy and react-osa are the calibration control pair: both run inside this one
 *     invocation, their spawn order alternates across repetitions, and the results carry the
 *     legacy-vs-osa ratio of medians for cold and warm.
 *   - compodoc is a one-shot CLI, so its adapter runs in-process here and spawns the compodoc CLI
 *     itself as the measured child; it skips with an explicit message when no binary is resolvable.
 *
 * A failed engine does not abort the suite: it is recorded as failed, the remaining engines keep
 * measuring, and the process exits 1 after the summary.
 *
 * Run:
 *   yarn bench:docgen-perf                # from scripts/, full profile
 *   yarn bench:docgen-perf --quick        # smoke profile; results marked non-comparable
 *   yarn bench:docgen-perf --engine react-legacy --engine react-osa
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SANDBOX_DIRECTORY } from './paths.ts';
import {
  DEFAULT_PROFILE,
  QUICK_PROFILE,
  RSS_POLL_INTERVAL_MS,
  type ReactScenarioConfig,
  type SuiteProfile,
  type VueScenarioConfig,
} from './config.ts';
import {
  type CompodocRepetition,
  resolveCompodocBinary,
  runCompodocRepetition,
} from './engines/compodoc.ts';
import { mean, median } from './stats.ts';
import {
  type EngineId,
  type EngineMetrics,
  type EngineResult,
  NOT_APPLICABLE,
  type SeriesHarnessResult,
  type SuiteResults,
} from './types.ts';

const ALL_ENGINES: EngineId[] = [
  'react-legacy',
  'react-legacy-rdt',
  'react-osa',
  'vue-component-meta',
  'compodoc',
];

/** react-legacy-rdt carries no budget row and only runs when named via --engine. */
const DEFAULT_ENGINES: EngineId[] = ['react-legacy', 'react-osa', 'vue-component-meta', 'compodoc'];

const WORK_ROOT = path.join(SANDBOX_DIRECTORY, 'docgen-perf');
const OSA_HARNESS = path.join(import.meta.dirname, '../docgen-memory/memory-harness.ts');
const LEGACY_HARNESS = path.join(import.meta.dirname, 'engines', 'react-legacy.ts');
const VUE_HARNESS = path.join(import.meta.dirname, 'engines', 'vue-component-meta.ts');

interface CliOptions {
  quick: boolean;
  engines: EngineId[];
  jsonOut: string;
}

function parseArgs(argv: string[]): CliOptions {
  const engines: EngineId[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--engine' && argv[i + 1]) {
      const engine = argv[i + 1] as EngineId;
      if (!ALL_ENGINES.includes(engine)) {
        throw new Error(`--engine must be one of ${ALL_ENGINES.join(', ')}, got "${argv[i + 1]}"`);
      }
      engines.push(engine);
    }
  }
  const jsonIdx = argv.indexOf('--json');
  return {
    quick: argv.includes('--quick'),
    engines: engines.length ? engines : DEFAULT_ENGINES,
    jsonOut:
      jsonIdx >= 0 && argv[jsonIdx + 1]
        ? argv[jsonIdx + 1]
        : path.join(WORK_ROOT, 'results.json'),
  };
}

/**
 * The control pair alternates spawn order across repetitions so cache warming and thermal drift do
 * not consistently favor one side.
 */
function engineOrderForRep(engines: EngineId[], rep: number): EngineId[] {
  const order = [...engines];
  const legacyIdx = order.indexOf('react-legacy');
  const osaIdx = order.indexOf('react-osa');
  if (legacyIdx >= 0 && osaIdx >= 0 && rep % 2 === 0) {
    order[legacyIdx] = 'react-osa';
    order[osaIdx] = 'react-legacy';
  }
  return order;
}

function reactChildInvocation(engine: EngineId, cfg: ReactScenarioConfig) {
  const sizeArgs = [
    '--components', String(cfg.components),
    '--variants', String(cfg.variants),
    '--props', String(cfg.props),
    '--saves', String(cfg.saves),
  ];
  if (engine === 'react-osa') {
    return { childPath: OSA_HARNESS, args: [...sizeArgs, '--mode', 'refresh', '--scope', 'changed'] };
  }
  const parser = engine === 'react-legacy-rdt' ? 'react-docgen-typescript' : 'react-docgen';
  return { childPath: LEGACY_HARNESS, args: [...sizeArgs, '--parser', parser] };
}

function vueChildInvocation(scenario: VueScenarioConfig) {
  return {
    childPath: VUE_HARNESS,
    args: [
      '--scenario', scenario.name,
      '--packages', String(scenario.packages),
      '--components-per-package', String(scenario.componentsPerPackage),
      '--chain-depth', String(scenario.chainDepth),
      '--fan-out', String(scenario.fanOut),
      ...(scenario.heavyLib ? ['--heavy-lib'] : []),
      '--saves', String(scenario.saves),
    ],
  };
}

/**
 * Spawn one fresh series-harness child (the gate.ts pattern) and read back its result JSON. A
 * non-zero exit or a missing/unparseable JSON is a failure.
 *
 * The new engine children run on native Node type stripping; only the reused docgen-memory harness
 * still needs the jiti loader. Under jiti, react-docgen's browserslist dependency fails on its JSON
 * data require ("jsReleases.map is not a function"), so the legacy child must NOT run under jiti.
 */
function runSeriesChild(
  childPath: string,
  childArgs: string[],
  outDir: string,
  jsonPath: string
): SeriesHarnessResult {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  // Remove any stale result so a crashed run cannot be mistaken for a prior success.
  fs.rmSync(jsonPath, { force: true });

  const nodeArgs = [
    '--expose-gc',
    ...(childPath === OSA_HARNESS ? ['--import', 'jiti/register'] : []),
    childPath,
    ...childArgs,
    '--out',
    outDir,
    '--json',
    jsonPath,
  ];
  const proc = spawnSync(process.execPath, nodeArgs, { encoding: 'utf8' });
  const output = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
  const tail = output.trim().split('\n').slice(-4).map((line) => `    ${line}`).join('\n');

  if (proc.status !== 0) {
    throw new Error(`child exited with status ${proc.status}:\n${tail}`);
  }
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`child wrote no result JSON at ${jsonPath}:\n${tail}`);
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as SeriesHarnessResult;
}

interface SeriesCollector {
  coldSamples: number[];
  /** The first repetition's full result; warm and memory metrics read this run. */
  designated?: SeriesHarnessResult;
}

function seriesMetrics(collector: SeriesCollector | undefined): EngineMetrics {
  if (!collector?.designated) {
    throw new Error('no completed repetition recorded');
  }
  const { designated } = collector;
  const warmSamples = designated.samples.map((s) => s.durMs);
  if (warmSamples.some((v) => v === undefined)) {
    throw new Error('save series carries no durations (child predates latency persistence)');
  }
  const transients = designated.samples
    .map((s) => (s.retainedHeapMb !== undefined ? s.heapUsedMb - s.retainedHeapMb : undefined))
    .filter((v): v is number => v !== undefined);
  if (
    transients.length === 0 ||
    designated.retainedGrowth === undefined ||
    designated.retainedSlope === undefined
  ) {
    throw new Error('retained metrics missing (child must run under --expose-gc)');
  }
  return {
    coldExtractionMs: {
      status: 'measured',
      samples: collector.coldSamples,
      median: median(collector.coldSamples),
    },
    warmExtractionMs: { status: 'measured', samples: warmSamples, median: median(warmSamples) },
    wholeProjectScanMs: NOT_APPLICABLE,
    peakTransientMb: { status: 'measured', samples: transients, mean: mean(transients) },
    retainedGrowthMb: { status: 'measured', value: designated.retainedGrowth },
    retainedSlopeMbPerSave: { status: 'measured', value: designated.retainedSlope },
  };
}

function compodocMetrics(reps: CompodocRepetition[]): EngineMetrics {
  if (reps.length === 0) {
    throw new Error('no completed repetition recorded');
  }
  const coldSamples = reps.map((r) => r.coldMs);
  const warmSamples = reps.map((r) => r.warmMs);
  const peaks = reps.map((r) => r.peakRssMb);
  return {
    coldExtractionMs: { status: 'measured', samples: coldSamples, median: median(coldSamples) },
    warmExtractionMs: { status: 'measured', samples: warmSamples, median: median(warmSamples) },
    // Cold extraction and the whole-project scan are the same full-project run for a one-shot CLI.
    wholeProjectScanMs: { status: 'measured', samples: coldSamples, median: median(coldSamples) },
    peakTransientMb: { status: 'measured', samples: peaks, mean: mean(peaks) },
    retainedGrowthMb: NOT_APPLICABLE,
    retainedSlopeMbPerSave: NOT_APPLICABLE,
  };
}

function formatCell(metric: EngineMetrics[keyof EngineMetrics], unit: 'ms' | 'MB'): string {
  if (metric.status === 'n/a') {
    return 'n/a';
  }
  if ('median' in metric) {
    return `${metric.median.toFixed(0)}${unit}`;
  }
  if ('mean' in metric) {
    return `${metric.mean.toFixed(0)}${unit}`;
  }
  return `${metric.value.toFixed(unit === 'MB' ? 1 : 0)}${unit}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const profile: SuiteProfile = options.quick ? QUICK_PROFILE : DEFAULT_PROFILE;

  console.log('docgen-perf suite');
  console.log(
    `  engines=${options.engines.join(',')} n=${profile.n} comparable=${profile.comparable}`
  );
  if (!profile.comparable) {
    console.log('  QUICK PROFILE: results are non-comparable smoke numbers');
  }

  const state = new Map<string, SeriesCollector>();
  const failed = new Map<EngineId, string>();
  const skipped = new Map<EngineId, string>();
  const compodocReps: CompodocRepetition[] = [];

  const compodocBinary = options.engines.includes('compodoc') ? resolveCompodocBinary() : undefined;
  if (options.engines.includes('compodoc') && !compodocBinary) {
    skipped.set(
      'compodoc',
      'no compodoc binary found (workspace node_modules/.bin or PATH); @compodoc/compodoc is a user-project dependency'
    );
    console.log(`  compodoc: SKIPPED - ${skipped.get('compodoc')}`);
  }

  const runSeries = (engine: EngineId, scenarioName: string, rep: number) => {
    const invocation =
      engine === 'vue-component-meta'
        ? vueChildInvocation(profile.vue.find((s) => s.name === scenarioName)!)
        : reactChildInvocation(engine, profile.react);
    const key = `${engine}/${scenarioName}`;
    const scenarioDir = path.join(WORK_ROOT, engine, scenarioName);
    console.log(`  ${key} (rep ${rep}/${profile.n})…`);
    const result = runSeriesChild(
      invocation.childPath,
      invocation.args,
      path.join(scenarioDir, 'project'),
      path.join(scenarioDir, `rep${rep}.json`)
    );
    const collector = state.get(key) ?? { coldSamples: [] };
    collector.coldSamples.push(result.coldMs);
    if (collector.designated === undefined) {
      collector.designated = result;
    }
    state.set(key, collector);
    console.log(`    cold=${result.coldMs}ms`);
  };

  for (let rep = 1; rep <= profile.n; rep++) {
    console.log(`\n=== repetition ${rep}/${profile.n} ===`);
    for (const engine of engineOrderForRep(options.engines, rep)) {
      if (failed.has(engine) || skipped.has(engine)) {
        continue;
      }
      try {
        if (engine === 'compodoc') {
          const repetition = await runCompodocRepetition(
            compodocBinary as string,
            profile.angular,
            path.join(WORK_ROOT, 'compodoc'),
            RSS_POLL_INTERVAL_MS
          );
          compodocReps.push(repetition);
          console.log(
            `  compodoc: cold=${repetition.coldMs}ms warm=${repetition.warmMs}ms ` +
              `peakRss=${repetition.peakRssMb.toFixed(0)}MB`
          );
        } else if (engine === 'vue-component-meta') {
          for (const scenario of profile.vue) {
            runSeries(engine, scenario.name, rep);
          }
        } else {
          runSeries(engine, 'default', rep);
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        failed.set(engine, reason);
        console.error(`  ${engine} FAILED: ${reason}`);
      }
    }
  }

  const engineResults: SuiteResults['engines'] = {};
  for (const engine of options.engines) {
    const skipReason = skipped.get(engine);
    if (skipReason) {
      engineResults[engine] = { status: 'skipped', reason: skipReason };
      continue;
    }
    try {
      if (engine === 'compodoc') {
        engineResults[engine] = {
          status: 'measured',
          scenarios: { default: { params: { ...profile.angular }, metrics: compodocMetrics(compodocReps) } },
        };
      } else if (engine === 'vue-component-meta') {
        const scenarios: Extract<EngineResult, { status: 'measured' }>['scenarios'] = {};
        for (const scenario of profile.vue) {
          scenarios[scenario.name] = {
            params: { ...scenario },
            metrics: seriesMetrics(state.get(`${engine}/${scenario.name}`)),
          };
        }
        engineResults[engine] = { status: 'measured', scenarios };
      } else {
        engineResults[engine] = {
          status: 'measured',
          scenarios: {
            default: { params: { ...profile.react }, metrics: seriesMetrics(state.get(`${engine}/default`)) },
          },
        };
      }
    } catch (err) {
      const reason = failed.get(engine) ?? (err instanceof Error ? err.message : String(err));
      failed.set(engine, reason);
      engineResults[engine] = { status: 'failed', reason };
    }
  }

  // The calibration reference: react-docgen vs react-osa, both measured in this same invocation.
  const ratios: SuiteResults['ratios'] = {};
  const legacy = engineResults['react-legacy'];
  const osa = engineResults['react-osa'];
  if (legacy?.status === 'measured' && osa?.status === 'measured') {
    const legacyMetrics = legacy.scenarios.default.metrics;
    const osaMetrics = osa.scenarios.default.metrics;
    if (legacyMetrics.coldExtractionMs.status === 'measured' && osaMetrics.coldExtractionMs.status === 'measured') {
      ratios.coldLegacyVsOsa = legacyMetrics.coldExtractionMs.median / osaMetrics.coldExtractionMs.median;
    }
    if (legacyMetrics.warmExtractionMs.status === 'measured' && osaMetrics.warmExtractionMs.status === 'measured') {
      ratios.warmLegacyVsOsa = legacyMetrics.warmExtractionMs.median / osaMetrics.warmExtractionMs.median;
    }
  }

  const results: SuiteResults = {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    pinnedN: profile.n,
    comparable: profile.comparable,
    rssPollIntervalMs: RSS_POLL_INTERVAL_MS,
    engines: engineResults,
    ratios,
  };

  console.log('\nresults');
  const header = ['engine/scenario', 'cold', 'warm', 'scan', 'peak', 'ret-growth', 'ret-slope'];
  const rows: string[][] = [header];
  const statusLines: string[] = [];
  for (const engine of options.engines) {
    const result = engineResults[engine];
    if (!result) {
      continue;
    }
    if (result.status !== 'measured') {
      statusLines.push(`  ${engine}: ${result.status.toUpperCase()} - ${result.reason.split('\n')[0]}`);
      continue;
    }
    for (const [scenarioName, scenario] of Object.entries(result.scenarios)) {
      const m = scenario.metrics;
      rows.push([
        `${engine}/${scenarioName}`,
        formatCell(m.coldExtractionMs, 'ms'),
        formatCell(m.warmExtractionMs, 'ms'),
        formatCell(m.wholeProjectScanMs, 'ms'),
        formatCell(m.peakTransientMb, 'MB'),
        formatCell(m.retainedGrowthMb, 'MB'),
        m.retainedSlopeMbPerSave.status === 'measured'
          ? `${m.retainedSlopeMbPerSave.value.toFixed(2)}MB/save`
          : 'n/a',
      ]);
    }
  }
  const widths = header.map((_, col) => Math.max(...rows.map((row) => (row[col] ?? '').length)));
  for (const row of rows) {
    console.log(`  ${row.map((cell, col) => (cell ?? '').padEnd(widths[col])).join('  ')}`);
  }
  for (const line of statusLines) {
    console.log(line);
  }
  if (ratios.coldLegacyVsOsa !== undefined) {
    console.log(`  ratio cold legacy/osa: ${ratios.coldLegacyVsOsa.toFixed(2)}`);
  }
  if (ratios.warmLegacyVsOsa !== undefined) {
    console.log(`  ratio warm legacy/osa: ${ratios.warmLegacyVsOsa.toFixed(2)}`);
  }
  if (!profile.comparable) {
    console.log('  QUICK PROFILE: results are non-comparable smoke numbers');
  }

  fs.mkdirSync(path.dirname(options.jsonOut), { recursive: true });
  fs.writeFileSync(options.jsonOut, JSON.stringify(results, null, 2));
  console.log(`  wrote ${options.jsonOut}`);

  if (failed.size > 0) {
    console.error('\ndocgen-perf suite FAILED:');
    for (const [engine, reason] of failed) {
      console.error(`  - ${engine}: ${reason}`);
    }
    process.exit(1);
  }
  console.log('\ndocgen-perf suite completed.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
