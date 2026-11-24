/**
 * Summarizes the samples written by `run.ts`: per scenario and setup, the distribution of the build
 * time, and the difference to the esbuild baseline with a bootstrap confidence interval.
 *
 * Usage: `node report.ts <results.json> <summary.json>`; a Markdown digest goes to stdout.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [resultsFile, summaryFile] = process.argv.slice(2);
const results = JSON.parse(readFileSync(resultsFile, 'utf8'));

const BASELINE = 'esbuild';
const BOOTSTRAP_RESAMPLES = 2000;

const quantile = (sorted: number[], q: number) => {
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
};
const median = (values: number[]) =>
  quantile(
    [...values].sort((a, b) => a - b),
    0.5
  );

// A fixed seed keeps the confidence intervals identical between runs of this script
let seed = 0x2f6e2b1;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const resample = (values: number[]) =>
  values.map(() => values[Math.floor(random() * values.length)]);

const describe = (values: number[]) => {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return {
    n: values.length,
    min: sorted[0],
    p10: quantile(sorted, 0.1),
    p25: quantile(sorted, 0.25),
    median: quantile(sorted, 0.5),
    p75: quantile(sorted, 0.75),
    p90: quantile(sorted, 0.9),
    max: sorted[sorted.length - 1],
    mean,
    sd: Math.sqrt(variance),
  };
};

/** Difference of medians to the baseline, with a 95% percentile bootstrap interval. */
const compare = (values: number[], baseline: number[]) => {
  if (values.length === 0 || baseline.length === 0) {
    return null;
  }
  const deltaMs = median(values) - median(baseline);
  const ratio = median(values) / median(baseline);
  const ratios: number[] = [];
  for (let i = 0; i < BOOTSTRAP_RESAMPLES; i++) {
    ratios.push(median(resample(values)) / median(resample(baseline)));
  }
  ratios.sort((a, b) => a - b);
  const low = quantile(ratios, 0.025);
  const high = quantile(ratios, 0.975);
  return {
    deltaMs,
    deltaPct: (ratio - 1) * 100,
    ciLowPct: (low - 1) * 100,
    ciHighPct: (high - 1) * 100,
    // The interval excludes "no difference"
    significant: low > 1 || high < 1,
  };
};

const round = (value: number) => Math.round(value * 10) / 10;

// Scenarios that have not run yet have no results; a partial file can still be summarized
const measured = results.scenarios.filter(
  (scenario: any) => Object.keys(scenario.results).length > 0
);

const scenarios = measured.map((scenario: any) => {
  const baseline = scenario.results[BASELINE];
  return {
    id: scenario.id,
    kind: scenario.kind,
    mode: scenario.mode,
    label: scenario.label,
    group: scenario.group,
    entryCount: scenario.entryCount,
    series: scenario.series.map(({ id, label }: { id: string; label: string }) => {
      const data = scenario.results[id];
      return {
        id,
        label,
        error: data.error,
        jsBytes: data.jsBytes,
        files: data.files,
        cold: describe(data.cold),
        warm: describe(data.warm),
        load: describe(data.load),
        coldVsBaseline: id === BASELINE ? null : compare(data.cold, baseline.cold),
        warmVsBaseline: id === BASELINE ? null : compare(data.warm, baseline.warm),
        samples: { cold: data.cold.map(round), warm: data.warm.map(round) },
      };
    }),
  };
});

writeFileSync(
  summaryFile,
  JSON.stringify({
    meta: results.meta,
    entries: results.entries,
    withoutEntry: results.withoutEntry,
    scenarios,
  })
);

const ms = (value?: number) => (value === undefined ? '–' : `${value.toFixed(0)} ms`);
const pct = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`;
const versus = (comparison: ReturnType<typeof compare>) =>
  comparison
    ? `${comparison.deltaMs > 0 ? '+' : ''}${comparison.deltaMs.toFixed(0)} ms (${pct(comparison.deltaPct)}, CI ${pct(comparison.ciLowPct)}…${pct(comparison.ciHighPct)})${comparison.significant ? '' : ' n.s.'}`
    : '';

for (const temperature of ['cold', 'warm'] as const) {
  for (const scenario of scenarios.filter((item: any) => item.kind === 'whole')) {
    process.stdout.write(
      `\n### ${scenario.id}, ${temperature}, ${scenario.entryCount} entries\n\n`
    );
    process.stdout.write(
      '| Setup | median | p10–p90 | min | vs esbuild | JS output |\n|---|---|---|---|---|---|\n'
    );
    for (const series of scenario.series) {
      const stats = series[temperature];
      const comparison = series[`${temperature}VsBaseline`];
      process.stdout.write(
        `| ${series.label} | ${ms(stats?.median)} | ${ms(stats?.p10)}–${ms(stats?.p90)} | ${ms(stats?.min)} | ${versus(comparison)} | ${(series.jsBytes / 1e6).toFixed(2)} MB |\n`
      );
    }
  }
}

for (const mode of ['dev', 'build']) {
  const entries = scenarios.filter((item: any) => item.kind === 'entry' && item.mode === mode);
  if (entries.length === 0) {
    continue;
  }
  const ids: string[] = entries[0].series.map((series: any) => series.id);
  process.stdout.write(`\n### Per entry, ${mode}, cold median\n\n`);
  process.stdout.write(
    `| Entry | group | ${ids.join(' | ')} |\n|---|---|${ids.map(() => '---').join('|')}|\n`
  );
  for (const scenario of entries) {
    const cells = scenario.series.map((series: any) =>
      series.id === BASELINE
        ? ms(series.cold?.median)
        : `${ms(series.cold?.median)} (${series.coldVsBaseline ? pct(series.coldVsBaseline.deltaPct) : ''}${series.coldVsBaseline?.significant ? '' : ' n.s.'})`
    );
    process.stdout.write(`| ${scenario.label} | ${scenario.group} | ${cells.join(' | ')} |\n`);
  }
}
