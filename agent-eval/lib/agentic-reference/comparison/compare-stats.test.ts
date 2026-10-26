// Direct tests for the Python statistics stage (scripts/compare_stats.py),
// staged without the TS pipeline: write dataset.csv + manifest.json, run the
// script, read what comes back. Covers the aggregate-mode degenerate-cell
// handling the end-to-end test's balanced fixtures can never reach.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findUv } from './uv.ts';

const uv = findUv();
const AGENT_EVAL_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const STATS_SCRIPT = join(AGENT_EVAL_ROOT, 'scripts', 'compare_stats.py');

const CONTROL = 'control-none';
const TREATMENT = 'do-dont';
const WF_A = '701-new-ui-flow';
const WF_B = '702-rework-ui-flow';

const root = mkdtempSync(join(tmpdir(), 'agentic-ref-stats-'));

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

function metricEntry(key: string) {
  return {
    key,
    label: key,
    transform: 'none',
    direction: 'lower-better',
    correctionGroup: 'confirmatory',
  };
}

interface StagedRow {
  metric: string;
  treatment: string;
  scope: string;
  context: boolean;
  beta: number;
  p: number;
  support: string | null;
  verdict: string | null;
}

interface StagedSkip {
  metric: string;
  treatment: string;
  scope: string;
  context: boolean;
  code: string;
  reason: string;
  nControl: number;
  nTreatment: number;
  treatmentMean: number | null;
}

/**
 * Two workflows, five runs per cell, four metrics probing the degenerate
 * shapes real judge data produces:
 * - `healthy` has a value in every run;
 * - `sparse` is missing from all but one treatment run in WF_B, leaving that
 *   case x workflow cell with a single value;
 * - `local` mirrors dsMisuseLocalDecision: the control arm has values only in
 *   WF_A, while the treatment has them everywhere;
 * - `constant` is exactly 1.0 in every run of both arms — zero variance.
 */
function stageDataset(): string {
  const dir = mkdtempSync(join(root, 'stage-'));
  const rows = [
    ['case', 'workflow', 'batch', 'run', 'healthy', 'sparse', 'local', 'constant'].join(','),
  ];
  const cells: object[] = [];
  for (const [caseName, workflow, offset] of [
    [CONTROL, WF_A, 0],
    [CONTROL, WF_B, 1],
    [TREATMENT, WF_A, 2],
    [TREATMENT, WF_B, 3],
  ] as const) {
    cells.push({
      case: caseName,
      workflow,
      usableRuns: 5,
      passed: 5,
      failed: 0,
      unanalyzed: 0,
      superseded: 0,
    });
    for (let run = 1; run <= 5; run++) {
      const healthy = 10 + offset + run;
      const sparse =
        caseName === TREATMENT && workflow === WF_B && run > 1 ? '' : String(20 + offset + run);
      const local = caseName === CONTROL && workflow === WF_B ? '' : String(30 + offset + run);
      rows.push(
        [caseName, workflow, 'batch-1', String(run), String(healthy), sparse, local, '1.0'].join(
          ','
        )
      );
    }
  }
  writeFileSync(join(dir, 'dataset.csv'), rows.join('\n') + '\n');
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify(
      {
        spec: {
          control: { shortName: CONTROL },
          treatments: [{ shortName: TREATMENT }],
          workflows: [WF_A, WF_B],
          mode: 'aggregate',
          minRuns: 5,
        },
        metrics: [
          metricEntry('healthy'),
          metricEntry('sparse'),
          metricEntry('local'),
          metricEntry('constant'),
        ],
        cells,
      },
      null,
      2
    ) + '\n'
  );
  return dir;
}

describe.skipIf(uv === null)('compare_stats.py aggregate mode', () => {
  let dir: string;
  let stderr: string;
  let estimates: StagedRow[];
  let skips: StagedSkip[];
  let report: string;

  beforeAll(() => {
    dir = stageDataset();
    const result = spawnSync(uv!, ['run', '--frozen', STATS_SCRIPT, dir], {
      cwd: AGENT_EVAL_ROOT,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    stderr = result.stderr;
    estimates = JSON.parse(readFileSync(join(dir, 'estimates.json'), 'utf8'));
    skips = JSON.parse(readFileSync(join(dir, 'skips.json'), 'utf8'));
    report = readFileSync(join(dir, 'report.md'), 'utf8');
  }, 240_000);

  it('emits no regression warnings on degenerate shapes', () => {
    // HC3 leverage is 1 on a singleton cell and rank-deficiency splits
    // coefficients arbitrarily; both flooded stderr before the fits were
    // restricted to their common support.
    expect(stderr).not.toContain('RuntimeWarning');
    expect(stderr).not.toContain('SingularMatrixWarning');
  });

  it('fits the dense metric across the full grid', () => {
    const healthy = estimates.find((row) => row.metric === 'healthy' && !row.context);
    expect(healthy?.verdict).toBeDefined();
    expect(Number.isFinite(healthy!.beta)).toBe(true);
    expect(healthy!.support).toBe(`${WF_A}+${WF_B}`);
  });

  it('pools a sparse metric over its common support instead of deleting it', () => {
    // sparse has a singleton treatment cell in WF_B: that workflow leaves
    // the pooled support, but WF_A still carries a full 5v5 comparison.
    const pooled = sparseRow(false, 'pooled');
    expect(pooled).toBeDefined();
    expect(pooled!.support).toBe(WF_A);
    expect(Number.isFinite(pooled!.beta)).toBe(true);
    const context = sparseRow(true, WF_A);
    expect(context).toBeDefined();
    const skip = skips.find((s) => s.metric === 'sparse' && s.scope === WF_B);
    expect(skip?.context).toBe(true);
    expect(skip?.code).toBe('insufficient-data');
    function sparseRow(context: boolean, scope: string) {
      return estimates.find(
        (row) => row.metric === 'sparse' && row.context === context && row.scope === scope
      );
    }
  });

  it('keeps per-workflow rows independent of the pooled fit and names missing arms', () => {
    // local has no control data in WF_B: the pooled fit shrinks to WF_A,
    // WF_A gets its context row, and WF_B gets a skip naming why — with the
    // treatment's own descriptive stats preserved for the reports.
    const pooled = estimates.find(
      (row) => row.metric === 'local' && !row.context && row.scope === 'pooled'
    );
    expect(pooled?.support).toBe(WF_A);
    expect(
      estimates.find((row) => row.metric === 'local' && row.context && row.scope === WF_A)
    ).toBeDefined();
    const skip = skips.find((s) => s.metric === 'local' && s.scope === WF_B);
    expect(skip?.code).toBe('no-control-data');
    expect(skip?.reason).toContain('no control data');
    expect(skip?.nControl).toBe(0);
    expect(skip?.nTreatment).toBe(5);
    // mean of 34..38
    expect(skip?.treatmentMean).toBeCloseTo(36, 5);
    expect(report).toContain('no control data');
  });

  it('records a constant response as identical arms instead of minting p-values', () => {
    // Before the variance guard, OLS solver noise on an all-1.0 response
    // produced beta ~1e-15 with se ~1e-16 — and p < 0.05 out of nothing.
    // Both arms carry data whenever the guard fires, so the honest verdict
    // is "identical: zero difference, nothing to test", never a fake p.
    expect(estimates.filter((row) => row.metric === 'constant')).toEqual([]);
    const headline = skips.find((s) => s.metric === 'constant' && !s.context);
    expect(headline?.code).toBe('identical');
    expect(headline?.reason).toContain('every run in both arms scored');
    expect(report).toContain('identical');
  });
});

describe.skipIf(uv !== null)('without uv', () => {
  it('is skipped on machines lacking uv (run yarn results:compare:setup)', () => {
    expect(uv).toBeNull();
  });
});
