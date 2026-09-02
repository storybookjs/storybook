// Direct tests for the Python statistics stage (scripts/compare_stats.py),
// staged without the TS pipeline: write dataset.csv + manifest.json, run the
// script, read what comes back. Covers the aggregate-mode degenerate-cell
// handling the end-to-end test's balanced fixtures can never reach.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

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

/**
 * Two workflows, five runs per cell. `healthy` has a value in every run;
 * `sparse` is missing from all but one treatment run in WF_B, leaving that
 * case x workflow cell with a single value.
 */
function stageSingletonCellDataset(): string {
  const dir = mkdtempSync(join(root, 'stage-'));
  const rows = [['case', 'workflow', 'batch', 'run', 'healthy', 'sparse'].join(',')];
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
      rows.push([caseName, workflow, 'batch-1', String(run), String(healthy), sparse].join(','));
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
        metrics: [metricEntry('healthy'), metricEntry('sparse')],
        cells,
      },
      null,
      2
    ) + '\n'
  );
  return dir;
}

describe.skipIf(uv === null)('compare_stats.py aggregate mode', () => {
  it('skips a singleton case x workflow cell cleanly instead of blowing up HC3', () => {
    const dir = stageSingletonCellDataset();
    const result = spawnSync(uv!, ['run', '--frozen', STATS_SCRIPT, dir], {
      cwd: AGENT_EVAL_ROOT,
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    // HC3 leverage is 1 on a singleton cell, so an unguarded fit floods
    // stderr with divide-by-zero RuntimeWarnings before NaN-ing out.
    expect(result.stderr).not.toContain('RuntimeWarning');

    const estimates = JSON.parse(readFileSync(join(dir, 'estimates.json'), 'utf8'));
    const sparseRows = estimates.filter((row: { metric: string }) => row.metric === 'sparse');
    expect(sparseRows).toEqual([]);
    const report = readFileSync(join(dir, 'report.md'), 'utf8');
    // The skip names the thin cell; "zero variance" would misdiagnose it.
    expect(report).toContain(
      `- sparse × ${TREATMENT}: needs >=2 values per case x workflow cell, have ${TREATMENT}@${WF_B}=1`
    );
    expect(report).not.toContain('zero variance');

    // The dense metric still gets a finite pooled estimate.
    const healthy = estimates.find(
      (row: { metric: string; context: boolean }) => row.metric === 'healthy' && !row.context
    );
    expect(healthy.verdict).toBeDefined();
    expect(Number.isFinite(healthy.beta)).toBe(true);
  }, 120_000);
});

describe.skipIf(uv !== null)('without uv', () => {
  it('is skipped on machines lacking uv (run yarn workspace agent-eval run results:compare:setup)', () => {
    expect(uv).toBeNull();
  });
});
