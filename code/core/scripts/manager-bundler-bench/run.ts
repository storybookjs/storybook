/**
 * Measures the manager builder's bundling step with several bundler setups and writes every sample
 * to a JSON file.
 *
 * Two kinds of scenarios are measured, each in `dev` and `build` mode:
 *
 * - `whole`: every manager entry in one call, which is what Storybook does.
 * - `entry`: one manager entry on its own, to see how each addon behaves.
 *
 * Samples of the compared setups are interleaved in random order, one process at a time, so drift
 * in machine load affects every setup alike.
 *
 * Run from `code/`, after `collect.ts`:
 * `node core/scripts/manager-bundler-bench/run.ts <results.json> [--pr-core-dir <dir>] [--only whole|entry] [--series <id,id>]`
 */
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';

import type { Input } from './worker.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'pr-core-dir': { type: 'string' },
    only: { type: 'string' },
    series: { type: 'string' },
    'whole-samples': { type: 'string', default: '40' },
    'entry-samples': { type: 'string', default: '20' },
    'warm-processes': { type: 'string', default: '3' },
    'warm-iterations': { type: 'string', default: '10' },
  },
});

const here = import.meta.dirname;
const outFile = resolve(positionals[0] ?? join(here, 'results.json'));
const collected = JSON.parse(readFileSync(join(here, 'entries.json'), 'utf8'));
const prCoreDir = values['pr-core-dir'] && resolve(values['pr-core-dir']);

/** Builds that only warm the process up and are dropped from the warm samples. */
const WARMUP_ITERATIONS = 2;

type Series = { id: string; label: string } & Pick<Input, 'bundler' | 'variant' | 'coreDir'>;

const esbuild: Series = { id: 'esbuild', label: 'esbuild (next)', bundler: 'esbuild' };
const dropIn: Series = { id: 'rolldown', label: 'Rolldown, drop-in', bundler: 'rolldown' };
const tuned: Series = {
  id: 'rolldown-tuned',
  label: 'Rolldown, tuned',
  bundler: 'rolldown',
  variant: 'native-externals,dce-only,no-treeshake',
};
const pr: Series[] = prCoreDir
  ? [{ id: 'pr37448', label: 'PR #37448 as is', bundler: 'external', coreDir: prCoreDir }]
  : [];

/** One change at a time from the drop-in setup, to see what each is worth. */
const ablations: Series[] = [
  // The counterpart on the esbuild side: the same work removed from the baseline
  {
    id: 'esbuild-lite',
    label: 'esbuild without minifySyntax and tree-shaking',
    bundler: 'esbuild',
    variant: 'lite',
  },
  { id: 'rolldown+dce', label: 'drop-in + dce-only', bundler: 'rolldown', variant: 'dce-only' },
  {
    id: 'rolldown+native',
    label: 'drop-in + native externals',
    bundler: 'rolldown',
    variant: 'native-externals',
  },
  {
    id: 'rolldown+notreeshake',
    label: 'drop-in + no tree-shaking',
    bundler: 'rolldown',
    variant: 'no-treeshake',
  },
];

type Scenario = {
  id: string;
  kind: 'whole' | 'entry';
  mode: Input['mode'];
  label: string;
  group: string;
  entries: string[];
  series: Series[];
  coldSamples: number;
};

const uniqueEntries = [
  ...new Map(
    (collected.entries as { file: string; label: string; group: string }[]).map((entry) => [
      entry.file,
      entry,
    ])
  ).values(),
];

const modes: Input['mode'][] = ['dev', 'build'];
const scenarios: Scenario[] = [
  ...modes.map((mode): Scenario => ({
    id: `whole/${mode}`,
    kind: 'whole',
    mode,
    label: 'All manager entries',
    group: 'whole',
    entries: collected.entries.map((entry: { file: string }) => entry.file),
    series: [esbuild, dropIn, tuned, ...pr, ...ablations],
    coldSamples: Number(values['whole-samples']),
  })),
  ...modes.flatMap((mode) =>
    uniqueEntries.map((entry): Scenario => ({
      id: `entry/${mode}/${entry.label}`,
      kind: 'entry',
      mode,
      label: entry.label,
      group: entry.group,
      entries: [entry.file],
      series: [esbuild, dropIn, tuned, ...pr],
      coldSamples: Number(values['entry-samples']),
    }))
  ),
]
  .filter((scenario) => !values.only || scenario.kind === values.only)
  .map((scenario) => ({
    ...scenario,
    series: scenario.series.filter(
      (series) => !values.series || values.series.split(',').includes(series.id)
    ),
  }));

const run = promisify(execFile);
const inputDir = mkdtempSync(join(tmpdir(), 'sb-manager-bench-input-'));

const sample = async (scenario: Scenario, series: Series, warmIterations: number) => {
  const inputFile = join(inputDir, 'input.json');
  const input: Input = {
    bundler: series.bundler,
    variant: series.variant,
    coreDir: series.coreDir,
    mode: scenario.mode,
    entries: scenario.entries,
    envs: collected.envs,
    cacheKey: collected.cacheKey,
    warmIterations,
    shimRemovedExports: true,
  };
  writeFileSync(inputFile, JSON.stringify(input));
  const { stdout } = await run(process.execPath, [join(here, 'worker.ts'), inputFile], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const line = stdout.split('\n').find((text) => text.startsWith('__RESULT__'));
  if (!line) {
    throw new Error(`No result from worker for ${scenario.id} / ${series.id}`);
  }
  return JSON.parse(line.slice('__RESULT__'.length));
};

const shuffled = <T>(items: T[]) =>
  items
    .map((item) => ({ item, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);

type SeriesResult = {
  cold: number[];
  load: number[];
  warm: number[];
  /** Kernel CPU time of each cold sample, in this process only. */
  coldSystem: number[];
  jsBytes?: number;
  files?: number;
  error?: string;
};

const results: Record<string, Record<string, SeriesResult>> = {};

const save = () =>
  writeFileSync(
    outFile,
    JSON.stringify({
      meta: {
        date: new Date().toISOString(),
        node: process.version,
        cpu: cpus()[0]?.model,
        cores: cpus().length,
        platform: `${process.platform}-${process.arch}`,
        prCoreDir,
        warmupIterations: WARMUP_ITERATIONS,
      },
      entries: collected.entries,
      withoutEntry: collected.withoutEntry,
      scenarios: scenarios.map(({ entries, series, ...scenario }) => ({
        ...scenario,
        entryCount: entries.length,
        series: series.map(({ id, label }) => ({ id, label })),
        results: results[scenario.id] ?? {},
      })),
    })
  );

const started = Date.now();
for (const [index, scenario] of scenarios.entries()) {
  const scenarioResults: Record<string, SeriesResult> = Object.fromEntries(
    scenario.series.map((series) => [series.id, { cold: [], load: [], warm: [], coldSystem: [] }])
  );
  results[scenario.id] = scenarioResults;
  const healthy = () => scenario.series.filter((series) => !scenarioResults[series.id].error);

  for (let round = 0; round < scenario.coldSamples; round++) {
    for (const series of shuffled(healthy())) {
      const target = scenarioResults[series.id];
      const result = await sample(scenario, series, 0);
      if (result.error) {
        target.error = result.error;
        continue;
      }
      target.cold.push(result.coldMs);
      target.coldSystem.push(result.usage.systemMs);
      if (result.loadMs !== null) {
        target.load.push(result.loadMs);
      }
      target.jsBytes = result.jsBytes;
      target.files = result.files;
    }
  }

  for (let round = 0; round < Number(values['warm-processes']); round++) {
    for (const series of shuffled(healthy())) {
      const target = scenarioResults[series.id];
      const iterations = Number(values['warm-iterations']) + WARMUP_ITERATIONS;
      const result = await sample(scenario, series, iterations);
      if (result.error) {
        target.error = result.error;
        continue;
      }
      target.warm.push(...result.warmMs.slice(WARMUP_ITERATIONS));
    }
  }

  save();
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  process.stdout.write(`[${index + 1}/${scenarios.length}] ${scenario.id} (${minutes} min)\n`);
}
