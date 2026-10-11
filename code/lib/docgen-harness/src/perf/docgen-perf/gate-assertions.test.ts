import { describe, expect, it } from 'vitest';

import type { PerfBudget, PerfBudgetKey } from '../docgen-shared/budgets.ts';
import { assertBudgets } from './gate-assertions.ts';
import {
  type EngineMetrics,
  type MeasuredMetric,
  NOT_APPLICABLE,
  type SuiteResults,
} from './types.ts';

const measuredLatency = (value: number): MeasuredMetric => ({
  status: 'measured',
  samples: [value],
  value,
});

function results(overrides: Partial<SuiteResults> = {}): SuiteResults {
  return {
    generatedAt: '2026-08-03T00:00:00.000Z',
    nodeVersion: 'v22.22.3',
    pinnedN: 6,
    comparable: true,
    engineVersions: {},
    engines: {
      'vue-component-meta': {
        status: 'measured',
        scenarios: {
          flat: {
            params: {},
            metrics: {
              coldExtractionMs: measuredLatency(200),
              warmExtractionMs: measuredLatency(20),
              wholeProjectScanMs: NOT_APPLICABLE,
              peakTransientMb: { status: 'measured', samples: [20], value: 20 },
              retainedGrowthMb: { status: 'measured', value: 3 },
              retainedSlopeMbPerSave: { status: 'measured', value: 0.2 },
            },
          },
        },
      },
    },
    ratios: {},
    ...overrides,
  };
}

/** One measured scenario with some of its metrics replaced, which is what most cases here vary. */
function withMetrics(patch: Partial<EngineMetrics>): SuiteResults {
  const base = results();
  const measured = base.engines['vue-component-meta'];
  if (measured?.status !== 'measured') {
    throw new Error('fixture must start from a measured engine');
  }
  const flat = measured.scenarios.flat;
  measured.scenarios.flat = { ...flat, metrics: { ...flat.metrics, ...patch } };
  return base;
}

const failures = (assertions: ReturnType<typeof assertBudgets>) => assertions.filter((a) => !a.ok);

describe('assertBudgets', () => {
  it('passes when every budgeted metric is within its budget', () => {
    const budgets: Partial<Record<PerfBudgetKey, PerfBudget>> = {
      'vue-component-meta/flat': {
        maxWarmColdRatio: 0.3,
        memory: { maxTransientMb: 60, maxRetainedSlopeMb: 1 },
      },
    };
    expect(failures(assertBudgets(results(), budgets))).toEqual([]);
  });

  it('fails a warm/cold ratio that says re-extraction stopped being incremental', () => {
    const slow = withMetrics({ warmExtractionMs: measuredLatency(190) });
    const found = failures(
      assertBudgets(slow, { 'vue-component-meta/flat': { maxWarmColdRatio: 0.3 } })
    );
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('no longer incremental');
  });

  it('fails a memory metric over budget', () => {
    const found = failures(
      assertBudgets(results(), {
        'vue-component-meta/flat': { memory: { maxTransientMb: 10 } },
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('exceeds the budget');
  });

  it('rejects a non-comparable run outright', () => {
    const found = failures(
      assertBudgets(results({ comparable: false }), {
        'vue-component-meta/flat': { maxWarmColdRatio: 0.3 },
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].label).toBe('run is comparable');
  });

  it('rejects an empty budget table rather than reporting a green gate', () => {
    expect(failures(assertBudgets(results(), {}))).toHaveLength(1);
  });

  it('fails a budgeted engine that skipped, because the protected thing did not run', () => {
    const skipped = results();
    skipped.engines['vue-component-meta'] = { status: 'skipped', reason: 'not installed' };
    const found = failures(
      assertBudgets(skipped, { 'vue-component-meta/flat': { maxWarmColdRatio: 0.3 } })
    );
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('skipped');
  });

  it('fails a scenario the run measured with no budget row, so a new one cannot land unprotected', () => {
    const extra = results();
    const measured = extra.engines['vue-component-meta'];
    if (measured?.status !== 'measured') {
      throw new Error('fixture must start from a measured engine');
    }
    measured.scenarios.workspace = measured.scenarios.flat;
    const found = failures(
      assertBudgets(extra, { 'vue-component-meta/flat': { maxWarmColdRatio: 0.3 } })
    );
    expect(found).toHaveLength(1);
    expect(found[0].detail).toContain('vue-component-meta/workspace');
  });

  it('fails a budgeted metric the run reported as n/a', () => {
    const partial = withMetrics({ retainedGrowthMb: NOT_APPLICABLE });
    const found = failures(
      assertBudgets(partial, {
        'vue-component-meta/flat': { memory: { maxRetainedGrowthMb: 10 } },
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].detail).toBe('not measured in this run');
  });
});
