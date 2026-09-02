import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findRuns } from '../../post-analysis/discovery.ts';
import type { ResolvedCase } from './resolve.ts';
import { autoSelectWorkflows, buildCells } from './cells.ts';
import { copyTaskFixture, measuredResultJson } from './test-fixtures.ts';
import { DS_MISUSE_JUDGE_VERSION, JUDGE_MODEL } from '../metrics/ds-misuse/context.ts';
import { dsDocsRefLabel } from '../metrics/ds-misuse/ds-docs.ts';

const CONTROL: ResolvedCase = {
  caseName: 'cc-control-none-opus-high',
  experiment: 'agentic-ref-cc-control-none-opus-high',
  shortName: 'control-none',
};
const TREATMENT: ResolvedCase = {
  caseName: 'cc-do-dont-opus-high',
  experiment: 'agentic-ref-cc-do-dont-opus-high',
  shortName: 'do-dont',
};
const TREATMENT2: ResolvedCase = {
  caseName: 'cc-full-opus-high',
  experiment: 'agentic-ref-cc-full-opus-high',
  shortName: 'full',
};
const BUNDLE: ResolvedCase = {
  caseName: 'bundled',
  experiment: 'bundled',
  shortName: 'bundled',
  pooledExperiments: [TREATMENT.experiment, TREATMENT2.experiment],
};
const WF = '703-fix-bug-flow';
const TS1 = '2026-08-01T00-00-00.000Z';
const TS2 = '2026-08-05T00-00-00.000Z';

let results: string;

beforeEach(() => {
  results = mkdtempSync(join(tmpdir(), 'compare-cells-'));
});
afterEach(() => {
  rmSync(results, { recursive: true, force: true });
});

type RunState =
  | 'usable'
  | 'infra'
  | 'unanalyzed'
  | 'outdated-analysis'
  | 'superseded'
  | 'malformed';

function mkRun(experiment: string, timestamp: string, run: number, state: RunState) {
  const dir = join(results, experiment, timestamp, WF, `run-${run}`);
  copyTaskFixture(WF, join(dir, 'project'));
  writeFileSync(
    join(dir, 'result.json'),
    JSON.stringify(
      measuredResultJson(experiment, WF, {
        status: state === 'infra' ? 'failed' : 'passed',
        superseded: state === 'superseded',
      })
    )
  );
  if (state === 'infra' || state === 'unanalyzed') return;
  if (state === 'malformed') {
    writeFileSync(join(dir, 'analysis.json'), '{not json');
    return;
  }
  writeFileSync(
    join(dir, 'analysis.json'),
    JSON.stringify({ speed: { durationSeconds: 100 + run } })
  );
  writeFileSync(
    join(dir, 'post-analysis-meta.json'),
    JSON.stringify({
      analyzedAt: 'x',
      ...(state === 'outdated-analysis' ? {} : { metricsVersion: 6 }),
      output: {},
    })
  );
}

function build(overrides: Partial<Parameters<typeof buildCells>[0]> = {}) {
  return buildCells({
    runs: findRuns(results),
    cases: [CONTROL, TREATMENT],
    workflows: [WF],
    minRuns: 2,
    metricsVersion: 6,
    ...overrides,
  });
}

describe('buildCells', () => {
  // A pair's sample is topped up across invocations, so its comparable runs
  // span several result directories; a cell is the union of them all.
  it('pools every batch of a cell into one sample', () => {
    for (let i = 1; i <= 2; i++) mkRun(CONTROL.experiment, TS1, i, 'usable');
    for (let i = 1; i <= 2; i++) mkRun(CONTROL.experiment, TS2, i, 'usable');
    for (let i = 1; i <= 2; i++) mkRun(TREATMENT.experiment, TS2, i, 'usable');
    const { cells, gaps } = build();
    expect(gaps).toEqual([]);
    expect(cells).toHaveLength(2);
    expect(cells.find((c) => c.case === CONTROL)!.runs).toHaveLength(4);
    expect(cells.find((c) => c.case === TREATMENT)!.runs).toHaveLength(2);
  });

  it('keeps superseded runs of an old batch out of the pooled sample', () => {
    mkRun(CONTROL.experiment, TS1, 1, 'superseded');
    mkRun(CONTROL.experiment, TS1, 2, 'superseded');
    for (let i = 1; i <= 2; i++) mkRun(CONTROL.experiment, TS2, i, 'usable');
    for (let i = 1; i <= 2; i++) mkRun(TREATMENT.experiment, TS2, i, 'usable');
    const { cells, gaps } = build();
    expect(gaps).toEqual([]);
    const control = cells.find((c) => c.case === CONTROL)!;
    expect(control.runs).toHaveLength(2);
    expect(control.superseded).toBe(2);
  });

  it('excludes infra failures and reports missing-runs gaps', () => {
    mkRun(CONTROL.experiment, TS2, 1, 'usable');
    mkRun(CONTROL.experiment, TS2, 2, 'infra');
    mkRun(TREATMENT.experiment, TS2, 1, 'usable');
    mkRun(TREATMENT.experiment, TS2, 2, 'usable');
    const { cells, gaps } = build();
    expect(gaps).toEqual([
      { case: CONTROL, workflow: WF, have: 1, need: 2, reason: 'missing-runs' },
    ]);
    expect(cells.find((c) => c.case === CONTROL)!.excluded).toEqual([
      { runDir: join(results, CONTROL.experiment, TS2, WF, 'run-2'), reason: 'infra-failure' },
    ]);
  });

  it('keeps superseded runs out of the sample and reports them as the gap', () => {
    mkRun(CONTROL.experiment, TS2, 1, 'usable');
    mkRun(CONTROL.experiment, TS2, 2, 'superseded');
    mkRun(TREATMENT.experiment, TS2, 1, 'usable');
    mkRun(TREATMENT.experiment, TS2, 2, 'usable');
    const { cells, gaps } = build();
    expect(gaps).toEqual([
      { case: CONTROL, workflow: WF, have: 1, need: 2, reason: 'superseded-runs' },
    ]);
    const control = cells.find((c) => c.case === CONTROL)!;
    expect(control.superseded).toBe(1);
    expect(control.runs).toHaveLength(1);
    // A superseded run belongs to a sample the cell no longer measures, so
    // it does not feed the cell's pass/fail context either.
    expect(control.passed).toBe(1);
  });

  it('counts an analysis stamped by older metrics code as unanalyzed', () => {
    mkRun(CONTROL.experiment, TS2, 1, 'usable');
    mkRun(CONTROL.experiment, TS2, 2, 'outdated-analysis');
    mkRun(TREATMENT.experiment, TS2, 1, 'usable');
    mkRun(TREATMENT.experiment, TS2, 2, 'usable');
    const { cells, gaps } = build();
    expect(gaps).toEqual([{ case: CONTROL, workflow: WF, have: 1, need: 2, reason: 'unanalyzed' }]);
    expect(cells.find((c) => c.case === CONTROL)!.unanalyzed).toBe(1);
  });

  it('classifies unanalyzed and superseded shortfalls distinctly', () => {
    mkRun(CONTROL.experiment, TS2, 1, 'usable');
    mkRun(CONTROL.experiment, TS2, 2, 'unanalyzed');
    mkRun(TREATMENT.experiment, TS2, 1, 'usable');
    mkRun(TREATMENT.experiment, TS2, 2, 'superseded');
    const { gaps } = build();
    expect(gaps).toEqual([
      { case: CONTROL, workflow: WF, have: 1, need: 2, reason: 'unanalyzed' },
      { case: TREATMENT, workflow: WF, have: 1, need: 2, reason: 'superseded-runs' },
    ]);
  });

  it('prefers unanalyzed when analysis alone could close the shortfall', () => {
    // Re-analyzing is free; superseded runs need collection. When either
    // count alone covers the shortfall, the free remediation wins.
    mkRun(CONTROL.experiment, TS2, 1, 'unanalyzed');
    mkRun(CONTROL.experiment, TS2, 2, 'unanalyzed');
    mkRun(CONTROL.experiment, TS2, 3, 'superseded');
    mkRun(CONTROL.experiment, TS2, 4, 'superseded');
    for (let i = 1; i <= 2; i++) mkRun(TREATMENT.experiment, TS2, i, 'usable');
    const { gaps } = build();
    expect(gaps).toEqual([{ case: CONTROL, workflow: WF, have: 0, need: 2, reason: 'unanalyzed' }]);
  });

  it('reports superseded-runs when only both counts together cover the shortfall', () => {
    // minRuns=3, usable=0 -> shortfall=3; unanalyzed=1 alone cannot close
    // it, so collection is needed and supersession is the reason to name.
    mkRun(CONTROL.experiment, TS2, 1, 'unanalyzed');
    mkRun(CONTROL.experiment, TS2, 2, 'superseded');
    mkRun(CONTROL.experiment, TS2, 3, 'superseded');
    for (let i = 1; i <= 3; i++) mkRun(TREATMENT.experiment, TS2, i, 'usable');
    const { gaps } = build({ minRuns: 3 });
    expect(gaps).toEqual([
      { case: CONTROL, workflow: WF, have: 0, need: 3, reason: 'superseded-runs' },
    ]);
  });

  it('pools every constituent experiment into a bundled case cell', () => {
    for (let i = 1; i <= 2; i++) mkRun(CONTROL.experiment, TS2, i, 'usable');
    for (let i = 1; i <= 2; i++) mkRun(TREATMENT.experiment, TS2, i, 'usable');
    for (let i = 1; i <= 2; i++) mkRun(TREATMENT2.experiment, TS2, i, 'usable');
    const { cells, gaps } = build({ cases: [CONTROL, BUNDLE] });
    expect(gaps).toEqual([]);
    expect(cells.find((c) => c.case === BUNDLE)!.runs).toHaveLength(4);
  });

  it('supersedes a bundled run against its own experiment, not the synthetic one', () => {
    for (let i = 1; i <= 2; i++) mkRun(CONTROL.experiment, TS2, i, 'usable');
    mkRun(TREATMENT.experiment, TS2, 1, 'usable');
    mkRun(TREATMENT.experiment, TS2, 2, 'superseded');
    mkRun(TREATMENT2.experiment, TS2, 1, 'usable');
    const { cells } = build({ cases: [CONTROL, BUNDLE] });
    const bundle = cells.find((c) => c.case === BUNDLE)!;
    expect(bundle.runs).toHaveLength(2);
    expect(bundle.superseded).toBe(1);
  });

  it('treats malformed analysis.json as excluded, not usable', () => {
    mkRun(CONTROL.experiment, TS2, 1, 'usable');
    mkRun(CONTROL.experiment, TS2, 2, 'malformed');
    mkRun(TREATMENT.experiment, TS2, 1, 'usable');
    mkRun(TREATMENT.experiment, TS2, 2, 'usable');
    const { cells, gaps } = build();
    expect(gaps[0]).toMatchObject({ reason: 'missing-runs', have: 1 });
    expect(cells.find((c) => c.case === CONTROL)!.excluded[0]).toMatchObject({
      reason: 'malformed-analysis',
    });
  });
});

describe('autoSelectWorkflows', () => {
  it('selects only workflows where every case passes the gate', () => {
    for (let i = 1; i <= 2; i++) mkRun(CONTROL.experiment, TS2, i, 'usable');
    for (let i = 1; i <= 2; i++) mkRun(TREATMENT.experiment, TS2, i, 'usable');
    const { selected, skipped } = autoSelectWorkflows({
      runs: findRuns(results),
      cases: [CONTROL, TREATMENT],
      candidates: [WF, '701-new-ui-flow'],
      minRuns: 2,
      metricsVersion: 6,
    });
    expect(selected).toEqual([WF]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]!.workflow).toBe('701-new-ui-flow');
  });
});

describe('misuse graft', () => {
  function writeMisuse(
    experiment: string,
    run: number,
    nodes: Array<Record<string, unknown>>,
    overrides: Record<string, unknown> = {}
  ) {
    const dir = join(results, experiment, TS1, WF, `run-${run}`);
    writeFileSync(
      join(dir, 'ds-misuse.json'),
      JSON.stringify({
        metricsVersion: 6,
        judgeVersion: DS_MISUSE_JUDGE_VERSION,
        judgedAt: 'x',
        model: JUDGE_MODEL,
        dsGuidelinesRef: dsDocsRefLabel(),
        fixtureRef: 'r@1',
        diffTruncated: false,
        summary: {
          correctDsDecision: null,
          correctDsUsage: null,
          correctLocalDecision: null,
          evaluated: { ds: 0, local: 0 },
        },
        nodes,
        ...overrides,
      })
    );
  }

  function dsMisuseOf(cells: ReturnType<typeof build>['cells']) {
    const usable = cells.find((c) => c.runs.length > 0)!.runs[0]!;
    return (usable.analysis as { dsMisuse?: Record<string, unknown> }).dsMisuse;
  }

  it('grafts the per-answer aggregate and the three sub-scores onto the analysis', () => {
    mkRun(CONTROL.experiment, TS1, 1, 'usable');
    writeMisuse(
      CONTROL.experiment,
      1,
      [
        {
          path: 'App/A[0]',
          file: 'a.tsx',
          line: 1,
          tag: 'A',
          kind: 'ds',
          correctDsDecision: { score: 1, reasons: [{ text: 'r' }] },
          correctDsUsage: { score: 0, reasons: [{ text: 'r' }] },
        },
        {
          path: 'App/B[0]',
          file: 'b.tsx',
          line: 2,
          tag: 'B',
          kind: 'local',
          correctLocalDecision: { score: 0.5, reasons: [{ text: 'r' }] },
        },
      ],
      {
        summary: {
          correctDsDecision: 0.5,
          correctDsUsage: 0,
          correctLocalDecision: 0.5,
          evaluated: { ds: 1, local: 1 },
        },
      }
    );
    const { cells } = build({ minRuns: 1, cases: [CONTROL], workflows: [WF] });
    // Aggregate is normalised over the three answers (1 + 0 + 0.5) / 3, so a
    // run with a big diff and a run with a small one land on the same scale.
    expect(dsMisuseOf(cells)).toEqual({
      score: 0.5,
      correctDsDecision: 0.5,
      correctDsUsage: 0,
      correctLocalDecision: 0.5,
      evaluated: { ds: 1, local: 1 },
      answers: 3,
      // None of the three reasons cites a facet, so they all pool into
      // 'uncategorised': (1 + 0 + 0.5) / 3.
      facets: { uncategorised: 0.5 },
    });
  });

  it('keys per-facet means by the sanitized facet id, absent when uncited', () => {
    mkRun(CONTROL.experiment, TS1, 1, 'usable');
    writeMisuse(
      CONTROL.experiment,
      1,
      [
        {
          path: 'App/A[0]',
          file: 'a.tsx',
          line: 1,
          tag: 'A',
          kind: 'ds',
          correctDsDecision: {
            score: 1,
            reasons: [{ facet: 'general.general-tokens', text: 'r' }],
          },
          correctDsUsage: {
            score: 0.5,
            reasons: [{ facet: 'mdx.do-dont', text: 'r' }],
          },
        },
        {
          path: 'App/B[0]',
          file: 'b.tsx',
          line: 2,
          tag: 'B',
          kind: 'local',
          correctLocalDecision: { score: 1, reasons: [{ text: 'r' }] },
        },
      ],
      {
        summary: {
          correctDsDecision: 1,
          correctDsUsage: 0.5,
          correctLocalDecision: 1,
          evaluated: { ds: 1, local: 1 },
        },
      }
    );
    const { cells } = build({ minRuns: 1, cases: [CONTROL], workflows: [WF] });
    const usable = cells.find((c) => c.runs.length > 0)!.runs[0]!;
    const misuse = (usable.analysis as { dsMisuse: { facets: Record<string, number> } }).dsMisuse;
    // One answer at 0.5 citing mdx.do-dont, one answer at 1 citing general.general-tokens:
    expect(misuse.facets.mdx_do_dont).toBe(0.5);
    expect(misuse.facets.general_general_tokens).toBe(1);
    // An answer with a facet-less reason feeds 'uncategorised'.
    expect(misuse.facets.uncategorised).toBe(1);
    // A facet nobody cited is absent, not 0.
    expect(misuse.facets.mdx_history).toBeUndefined();
  });

  it('dedupes a facet cited twice within one answer, and splits a compound answer between its facet and uncategorised', () => {
    mkRun(CONTROL.experiment, TS1, 1, 'usable');
    writeMisuse(
      CONTROL.experiment,
      1,
      [
        {
          path: 'App/A[0]',
          file: 'a.tsx',
          line: 1,
          tag: 'A',
          kind: 'ds',
          // One answer citing the same facet in two reasons: counts once,
          // not twice, toward that facet's denominator.
          correctDsUsage: {
            score: 1,
            reasons: [
              { facet: 'mdx.do-dont', text: 'a' },
              { facet: 'mdx.do-dont', text: 'b' },
            ],
          },
          // A second, separate answer citing the same facet once. If the
          // first answer's duplicate reason were not deduped, this facet's
          // mean would be (1 + 1 + 0) / 3 = 0.667 instead of 0.5.
          correctDsDecision: { score: 0, reasons: [{ facet: 'mdx.do-dont', text: 'c' }] },
        },
        {
          path: 'App/B[0]',
          file: 'b.tsx',
          line: 2,
          tag: 'B',
          kind: 'local',
          // A compound answer: one reason cites a facet, another cites
          // none. The single answer's score feeds both buckets.
          correctLocalDecision: {
            score: 0.5,
            reasons: [{ facet: 'general.general-tokens', text: 'd' }, { text: 'e' }],
          },
        },
      ],
      {
        summary: {
          correctDsDecision: 0,
          correctDsUsage: 1,
          correctLocalDecision: 0.5,
          evaluated: { ds: 1, local: 1 },
        },
      }
    );
    const { cells } = build({ minRuns: 1, cases: [CONTROL], workflows: [WF] });
    const usable = cells.find((c) => c.runs.length > 0)!.runs[0]!;
    const misuse = (usable.analysis as { dsMisuse: { facets: Record<string, number> } }).dsMisuse;
    expect(misuse.facets.mdx_do_dont).toBe(0.5);
    expect(misuse.facets.general_general_tokens).toBe(0.5);
    expect(misuse.facets.uncategorised).toBe(0.5);
  });

  it('leaves a stale judgement off rather than mixing standards', () => {
    mkRun(CONTROL.experiment, TS1, 1, 'usable');
    writeMisuse(CONTROL.experiment, 1, [], { dsGuidelinesRef: 'someone/else@old' });
    const { cells } = build({ minRuns: 1, cases: [CONTROL], workflows: [WF] });
    expect(dsMisuseOf(cells)).toBeUndefined();
  });

  it('grafts nothing on an unjudged run', () => {
    mkRun(CONTROL.experiment, TS1, 1, 'usable');
    const { cells } = build({ minRuns: 1, cases: [CONTROL], workflows: [WF] });
    expect(dsMisuseOf(cells)).toBeUndefined();
  });
});
