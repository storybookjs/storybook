import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { postAnalysis } from '../post-analysis.ts';
import { CASE_COLORS } from './colors.ts';
import { copyTaskFixture, measuredResultJson } from './test-fixtures.ts';
import { findUv } from './uv.ts';

const uv = findUv();
const AGENT_EVAL_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const CONTROL_EXP = 'agentic-ref-cc-control-none-opus-high';
const TREATMENT_EXP = 'agentic-ref-cc-do-dont-opus-high';
const WF = '703-fix-bug-flow';
const TS = '2026-08-05T00-00-00.000Z';

const CONTROL_DURATIONS = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
const CACHE_HIT_RATES = [0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89];

const root = mkdtempSync(join(tmpdir(), 'agentic-ref-compare-'));
const resultsDir = join(root, 'results');

function plantRun(
  experiment: string,
  run: number,
  durationSeconds: number,
  cacheHitRate: number,
  workflow = WF
) {
  const dir = join(resultsDir, experiment, TS, workflow, `run-${run}`);
  copyTaskFixture(workflow, join(dir, 'project'));
  writeFileSync(
    join(dir, 'result.json'),
    JSON.stringify(measuredResultJson(experiment, workflow)) + '\n'
  );
  const analysis = { speed: { durationSeconds }, cost: { cacheHitRate } };
  writeFileSync(join(dir, 'analysis.json'), JSON.stringify(analysis, null, 2) + '\n');
  writeFileSync(
    join(dir, 'post-analysis-meta.json'),
    JSON.stringify(
      { analyzedAt: 'fixture', metricsVersion: postAnalysis.metricsVersion, output: analysis },
      null,
      2
    ) + '\n'
  );
}

CONTROL_DURATIONS.forEach((duration, i) => {
  plantRun(CONTROL_EXP, i + 1, duration, CACHE_HIT_RATES[i]!);
  plantRun(TREATMENT_EXP, i + 1, duration * 2, CACHE_HIT_RATES[i]!);
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function runCompare(outDir: string, selection: string[] = ['--cases=do-dont', '--workflows=703']) {
  execFileSync(
    process.execPath,
    [join(AGENT_EVAL_ROOT, 'scripts', 'compare-results.ts'), ...selection, `--out=${outDir}`],
    { env: { ...process.env, AGENT_EVAL_RESULTS_DIR: resultsDir }, stdio: 'pipe' }
  );
}

describe.skipIf(uv === null)('results:compare end to end', () => {
  it('recovers a planted 2x duration effect and leaves the null metric alone', () => {
    const outDir = join(root, 'comparisons', 'a');
    runCompare(outDir);
    const estimates = JSON.parse(readFileSync(join(outDir, 'estimates.json'), 'utf8'));
    const duration = estimates.find(
      (row: { metric: string; context: boolean }) =>
        row.metric === 'durationSeconds' && !row.context
    );
    // Exactly doubled values: the log-scale effect is exactly log(2).
    expect(duration.beta).toBeCloseTo(Math.log(2), 6);
    expect(duration.verdict).toBe('significant');
    const cache = estimates.find((row: { metric: string }) => row.metric === 'cacheHitRate');
    expect(cache.verdict).toBe('not-significant');
    expect(readFileSync(join(outDir, 'report.md'), 'utf8')).toContain('durationSeconds');
    // The ECDF curves use the same stable case colors the HTML report gets
    // from the manifest.
    const curveSvg = readFileSync(
      join(outDir, 'curves', `durationSeconds@${WF}.svg`),
      'utf8'
    ).toLowerCase();
    expect(curveSvg).toContain(CASE_COLORS['do-dont']!.light.slice(1).toLowerCase());
    expect(curveSvg).toContain(CASE_COLORS['control-none']!.light.slice(1).toLowerCase());
  }, 300_000);

  it('is byte-for-byte deterministic apart from manifest provenance', () => {
    const a = join(root, 'comparisons', 'det-a');
    const b = join(root, 'comparisons', 'det-b');
    runCompare(a);
    runCompare(b);
    for (const file of ['dataset.csv', 'estimates.csv', 'estimates.json', 'report.md']) {
      expect(readFileSync(join(a, file))).toEqual(readFileSync(join(b, file)));
    }
    const curveFiles = (dir: string) => readdirSync(join(dir, 'curves')).sort();
    expect(curveFiles(a)).toEqual(curveFiles(b));
    for (const file of curveFiles(a)) {
      expect(readFileSync(join(a, 'curves', file))).toEqual(readFileSync(join(b, 'curves', file)));
    }
    const stripProvenance = (dir: string) => {
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
      delete manifest.provenance;
      return manifest;
    };
    expect(stripProvenance(a)).toEqual(stripProvenance(b));
  }, 300_000);

  it('scopes the comparison to a plan config via --plan', () => {
    const planPath = join(root, 'do-dont.plan.ts');
    writeFileSync(
      planPath,
      'export default {\n' +
        `\texperiments: ['${CONTROL_EXP}', '${TREATMENT_EXP}'],\n` +
        "\tevals: ['703'],\n" +
        '\truns: 10,\n' +
        '\tparallelMax: 10,\n' +
        '};\n'
    );
    const outDir = join(root, 'comparisons', 'plan');
    runCompare(outDir, [`--plan=${planPath}`]);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.spec.plan).toBe(planPath);
    expect(manifest.spec.treatments.map((t: { shortName: string }) => t.shortName)).toEqual([
      'do-dont',
    ]);
    expect(manifest.spec.workflows).toEqual([WF]);
    // min-runs defaulted to the plan's target sample size.
    expect(manifest.spec.minRuns).toBe(10);
    const estimates = JSON.parse(readFileSync(join(outDir, 'estimates.json'), 'utf8'));
    const duration = estimates.find(
      (row: { metric: string; context: boolean }) =>
        row.metric === 'durationSeconds' && !row.context
    );
    expect(duration.beta).toBeCloseTo(Math.log(2), 6);
  }, 300_000);

  it('pools every treatment into one bundled arm with --bundle', () => {
    // A second treatment at exactly x8 duration. Equal-sized pools at x2
    // (do-dont) and x8 make the bundled log effect their average: 2 * log 2.
    const FULL_EXP = 'agentic-ref-cc-full-opus-high';
    CONTROL_DURATIONS.forEach((duration, i) => {
      plantRun(FULL_EXP, i + 1, duration * 8, CACHE_HIT_RATES[i]!);
    });
    const outDir = join(root, 'comparisons', 'bundled');
    runCompare(outDir, ['--cases=do-dont,full', '--workflows=703', '--bundle']);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.spec.treatments.map((t: { shortName: string }) => t.shortName)).toEqual([
      'bundled',
    ]);
    expect(manifest.spec.treatments[0].pooledExperiments).toEqual([TREATMENT_EXP, FULL_EXP]);
    const dataset = readFileSync(join(outDir, 'dataset.csv'), 'utf8');
    expect(dataset.split('\n').filter((line) => line.startsWith('bundled,'))).toHaveLength(20);
    const estimates = JSON.parse(readFileSync(join(outDir, 'estimates.json'), 'utf8'));
    const duration = estimates.find(
      (row: { metric: string; context: boolean }) =>
        row.metric === 'durationSeconds' && !row.context
    );
    expect(duration.treatment).toBe('bundled');
    expect(duration.beta).toBeCloseTo(2 * Math.log(2), 6);
  }, 300_000);

  it('weights every workflow equally in aggregate mode, regardless of run counts', () => {
    // 703 has 10 runs per arm with an exact x2 duration effect (log 2).
    // Plant 15 runs per arm in 701 with an exact x4 effect (log 4). Equal
    // workflow weighting yields (log 2 + log 4) / 2 = 1.5 * log 2; run-count
    // weighting would yield (10*log2 + 15*log4) / 25 ≈ 1.109 instead.
    const WF2 = '701-new-ui-flow';
    for (let i = 1; i <= 15; i++) {
      plantRun(CONTROL_EXP, i, 200 + i, 0.8, WF2);
      plantRun(TREATMENT_EXP, i, (200 + i) * 4, 0.8, WF2);
    }
    const outDir = join(root, 'comparisons', 'equal-weight');
    runCompare(outDir, ['--cases=do-dont', '--workflows=701,703']);
    const estimates = JSON.parse(readFileSync(join(outDir, 'estimates.json'), 'utf8'));
    const duration = estimates.find(
      (row: { metric: string; context: boolean }) =>
        row.metric === 'durationSeconds' && !row.context
    );
    expect(duration.scope).toBe('pooled');
    expect(duration.beta).toBeCloseTo(1.5 * Math.log(2), 6);
    expect(readFileSync(join(outDir, 'report.md'), 'utf8')).toContain(
      'weight every workflow equally'
    );
  }, 300_000);

  it('early-exits with remediation commands when a cell is short', () => {
    rmSync(join(resultsDir, TREATMENT_EXP, TS, WF, 'run-10'), { recursive: true });
    try {
      let output = '';
      try {
        runCompare(join(root, 'comparisons', 'short'));
        expect.unreachable('should have exited non-zero');
      } catch (error) {
        const failed = error as { status: number; stderr: Buffer };
        expect(failed.status).toBe(1);
        output = failed.stderr.toString();
      }
      expect(output).toContain('9/10');
      // The table also lists the cells that are already complete.
      expect(output).toContain('10/10');
      expect(output).toContain('complete');
      expect(output).toContain(
        `AGENTIC_REF_FLOW=${WF} AGENTIC_REF_RUNS=10 yarn workspace agent-eval run eval:agentic-ref ${TREATMENT_EXP}`
      );
    } finally {
      // Restore for any later test ordering, even if an assertion above failed.
      plantRun(TREATMENT_EXP, 10, CONTROL_DURATIONS[9]! * 2, CACHE_HIT_RATES[9]!);
    }
  }, 300_000);
});

describe.skipIf(uv !== null)('without uv', () => {
  it('is skipped on machines lacking uv (run yarn workspace agent-eval run results:compare:setup)', () => {
    expect(uv).toBeNull();
  });
});
