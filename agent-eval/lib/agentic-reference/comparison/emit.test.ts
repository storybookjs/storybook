import { describe, expect, it } from 'vitest';

import { COMPARISON_METRICS } from '../comparison-metrics.ts';
import type { Cell } from './cells.ts';
import { CASE_COLORS } from './colors.ts';
import type { ResolvedCase } from './resolve.ts';
import { datasetCsv, manifestJson, type ComparisonSpec } from './emit.ts';

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

const SPEC: ComparisonSpec = {
  control: CONTROL,
  treatments: [TREATMENT],
  workflows: ['703-fix-bug-flow'],
  mode: 'single-workflow',
  minRuns: 1,
};

function cell(
  resolvedCase: ResolvedCase,
  values: number[],
  workflow: string = '703-fix-bug-flow'
): Cell {
  return {
    case: resolvedCase,
    workflow,
    runs: values.map((v, i) => ({
      run: {
        runDir: `/root/results/${
          resolvedCase.experiment
        }/2026-08-05T00-00-00.000Z/${workflow}/run-${i + 1}`,
        projectDir: '',
        experiment: resolvedCase.experiment,
        model: '',
        timestamp: '2026-08-05T00-00-00.000Z',
        evalName: workflow,
        run: i + 1,
        collected: true,
      },
      analysis: { speed: { durationSeconds: v } },
    })),
    excluded: [
      { runDir: `/root/results/${resolvedCase.experiment}/x/run-9`, reason: 'infra-failure' },
    ],
    unanalyzed: 0,
    superseded: 0,
    passed: values.length,
    failed: 1,
  };
}

describe('datasetCsv', () => {
  it('emits control rows first with metric columns in registry order', () => {
    const csv = datasetCsv([cell(TREATMENT, [5]), cell(CONTROL, [7])], COMPARISON_METRICS, SPEC);
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      `case,workflow,batch,run,${COMPARISON_METRICS.map((m) => m.key).join(',')}`
    );
    expect(lines[1]!.startsWith('control-none,703-fix-bug-flow,2026-08-05T00-00-00.000Z,1,7')).toBe(
      true
    );
    expect(lines[2]!.startsWith('do-dont,')).toBe(true);
    expect(csv.endsWith('\n')).toBe(true);
    // durationSeconds filled, every other metric column empty
    expect(lines[1]!.split(',').filter((v) => v !== '')).toHaveLength(5);
  });

  it('orders workflows numerically, not lexicographically', () => {
    const spec = {
      control: CONTROL,
      treatments: [TREATMENT],
      workflows: ['703-fix-bug-flow', '1701-wide-flow'],
      mode: 'single-workflow' as const,
      minRuns: 1,
    };
    const csv = datasetCsv(
      [cell(CONTROL, [7], '1701-wide-flow'), cell(CONTROL, [8], '703-fix-bug-flow')],
      COMPARISON_METRICS,
      spec
    );
    const lines = csv.split('\n').filter((line) => line !== '');
    // Numeric order: 703 < 1701, so 703-fix-bug-flow rows should come before 1701-wide-flow
    const controlRows = lines.slice(1).filter((line) => line.startsWith('control-none'));
    expect(controlRows[0]!.includes('703-fix-bug-flow')).toBe(true);
    expect(controlRows[1]!.includes('1701-wide-flow')).toBe(true);
  });
});

describe('manifestJson', () => {
  it('is canonical: fixed key order, relative paths, provenance last', () => {
    const json = manifestJson({
      spec: SPEC,
      metrics: COMPARISON_METRICS,
      cells: [cell(CONTROL, [7]), cell(TREATMENT, [5])],
      agentEvalRoot: '/root',
      provenance: { generatedAt: 'sometime' },
    });
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toEqual([
      'spec',
      'metrics',
      'family',
      'colors',
      'cells',
      'excludedRuns',
      'provenance',
    ]);
    expect(parsed.family[0]).toEqual({
      metric: 'durationSeconds',
      treatment: 'do-dont',
      correctionGroup: 'confirmatory',
    });
    expect(parsed.family).toHaveLength(COMPARISON_METRICS.length);
    expect(parsed.spec.plan).toBeNull();
    expect(parsed.spec.allBatches).toBeUndefined();
    expect(parsed.cells[0]).toMatchObject({ superseded: 0, unanalyzed: 0 });
    // The cell describes the pooled sample; per-run batches live in the dataset.
    expect(parsed.cells[0].batch).toBeUndefined();
    expect(parsed.excludedRuns[0].path.startsWith('results/')).toBe(true);
    expect(json.endsWith('\n')).toBe(true);
    expect(JSON.stringify(parsed, null, 2) + '\n').toBe(json);
  });

  it('tags each family pair with its metric correctionGroup', () => {
    const json = manifestJson({
      spec: SPEC,
      metrics: COMPARISON_METRICS,
      cells: [cell(CONTROL, [7]), cell(TREATMENT, [5])],
      agentEvalRoot: '/root',
      provenance: {},
    });
    const family = JSON.parse(json).family as Array<{
      metric: string;
      treatment: string;
      correctionGroup: string;
    }>;
    for (const pair of family) {
      const metric = COMPARISON_METRICS.find((m) => m.key === pair.metric);
      expect(pair.correctionGroup).toBe(metric?.correctionGroup);
    }
    // At least one pair from each correction group is present, so the split
    // isn't accidentally collapsed to a single family.
    expect(family.some((pair) => pair.correctionGroup === 'confirmatory')).toBe(true);
    expect(family.some((pair) => pair.correctionGroup === 'exploratory-misuse-facets')).toBe(true);
  });

  it('embeds the stable color of the control and every treatment', () => {
    const json = manifestJson({
      spec: SPEC,
      metrics: COMPARISON_METRICS,
      cells: [cell(CONTROL, [7]), cell(TREATMENT, [5])],
      agentEvalRoot: '/root',
      provenance: {},
    });
    const colors = JSON.parse(json).colors;
    expect(Object.keys(colors)).toEqual(['control-none', 'do-dont']);
    expect(colors['do-dont']).toEqual(CASE_COLORS['do-dont']);
  });

  it('records the plan a scoped comparison came from', () => {
    const json = manifestJson({
      spec: { ...SPEC, plan: 'plans/1-levels-edit.plan.ts' },
      metrics: COMPARISON_METRICS,
      cells: [cell(CONTROL, [7])],
      agentEvalRoot: '/root',
      provenance: {},
    });
    expect(JSON.parse(json).spec.plan).toBe('plans/1-levels-edit.plan.ts');
  });

  it('produces identical output for identical input (repeatability)', () => {
    const args = {
      spec: SPEC,
      metrics: COMPARISON_METRICS,
      cells: [cell(CONTROL, [7])],
      agentEvalRoot: '/root',
      provenance: {},
    };
    expect(manifestJson(args)).toBe(manifestJson(args));
  });
});
