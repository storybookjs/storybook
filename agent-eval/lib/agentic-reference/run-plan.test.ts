import { describe, expect, it } from 'vitest';

import { PLAIN_STYLE, type OutputStyle } from './style.ts';
import {
  type CellPlan,
  type PlanCell,
  type RunPlan,
  type StoredSample,
  explainDeficit,
  isPlanStoppingSignal,
  judgeSample,
  narrowedParallelMax,
  parseSince,
  planBatches,
  planCell,
  resolveExperimentSelection,
  resolveRunPlan,
  scanResourceSignals,
  topUpCommand,
} from './run-plan.ts';

const EXPERIMENTS = [
  'agentic-ref-cc-control-none-opus-high',
  'agentic-ref-cc-full-opus-high',
  'agentic-ref-cc-docs-full-opus-high',
];

const EVALS = [
  '701-new-ui-flow',
  '702-rework-ui-flow',
  '703-fix-bug-flow',
  '704-fix-a11y-flow',
  '706-new-ui-scheduled-flow',
];

const KNOWN = { experiments: EXPERIMENTS, evals: EVALS };

function plan(overrides: Partial<RunPlan> = {}): RunPlan {
  return {
    experiments: EXPERIMENTS,
    evals: ['701', '702'],
    runs: 10,
    parallelMax: 10,
    ...overrides,
  };
}

const CELL: PlanCell = { experiment: 'arm', evalName: '701-new-ui-flow' };

function sample(overrides: Partial<StoredSample> = {}): StoredSample {
  return {
    dir: '2026-08-15T13-20-41.492Z',
    at: new Date('2026-08-15T13:20:41.492Z'),
    current: true,
    runs: 10,
    ...overrides,
  };
}

describe('resolveExperimentSelection', () => {
  it('expands globs while keeping the order the plan listed', () => {
    expect(
      resolveExperimentSelection(['agentic-ref-cc-full-*', EXPERIMENTS[0]!], EXPERIMENTS)
    ).toEqual(['agentic-ref-cc-full-opus-high', 'agentic-ref-cc-control-none-opus-high']);
  });

  it('deduplicates names matched by more than one token', () => {
    expect(resolveExperimentSelection(['agentic-ref-*', EXPERIMENTS[1]!], EXPERIMENTS)).toEqual(
      EXPERIMENTS
    );
  });

  // A token resolving to nothing would run zero cells and report success.
  it('throws on a token that matches no experiment', () => {
    expect(() => resolveExperimentSelection(['agentic-ref-cc-typo'], EXPERIMENTS)).toThrow(
      /matches no known experiment/
    );
  });

  it('throws on an empty selection', () => {
    expect(() => resolveExperimentSelection([], EXPERIMENTS)).toThrow(/at least one experiment/);
  });
});

describe('resolveRunPlan', () => {
  it('lists cells eval-major, so a plan cut short leaves a balanced sample', () => {
    const { cells } = resolveRunPlan(plan(), KNOWN);

    expect(cells.map((cell) => `${cell.evalName} × ${cell.experiment}`)).toEqual([
      `701-new-ui-flow × ${EXPERIMENTS[0]}`,
      `701-new-ui-flow × ${EXPERIMENTS[1]}`,
      `701-new-ui-flow × ${EXPERIMENTS[2]}`,
      `702-rework-ui-flow × ${EXPERIMENTS[0]}`,
      `702-rework-ui-flow × ${EXPERIMENTS[1]}`,
      `702-rework-ui-flow × ${EXPERIMENTS[2]}`,
    ]);
  });

  it('rejects non-positive-integer knobs', () => {
    expect(() => resolveRunPlan(plan({ runs: 0 }), KNOWN)).toThrow(/runs must be a positive/);
    expect(() => resolveRunPlan(plan({ parallelMax: 2.5 }), KNOWN)).toThrow(
      /parallelMax must be a positive/
    );
  });

  it('resolves evals in registry order, whatever order the plan listed them', () => {
    expect(resolveRunPlan(plan({ evals: ['703', '701'] }), KNOWN).evals).toEqual([
      '701-new-ui-flow',
      '703-fix-bug-flow',
    ]);
  });

  it('defaults force and ackFailures off, and the cutoff to none', () => {
    expect(resolveRunPlan(plan(), KNOWN).plan).toMatchObject({
      force: false,
      ackFailures: false,
      since: null,
    });
  });
});

describe('the reuse cutoff', () => {
  it('accepts a bare date as UTC midnight, and a full datetime', () => {
    expect(parseSince('2026-08-16')?.toISOString()).toBe('2026-08-16T00:00:00.000Z');
    expect(parseSince('2026-08-16T09:30:00Z')?.toISOString()).toBe('2026-08-16T09:30:00.000Z');
  });

  it('treats an absent or empty cutoff as no cutoff', () => {
    expect(parseSince(undefined)).toBeNull();
    expect(parseSince('  ')).toBeNull();
  });

  it('rejects a date it cannot read, rather than silently reusing everything', () => {
    expect(() => parseSince('last tuesday')).toThrow(/must be an ISO date/);
  });

  it('fails the whole plan on an unreadable cutoff, before anything runs', () => {
    expect(() => resolveRunPlan(plan({ since: 'yesterday' }), KNOWN)).toThrow(
      /must be an ISO date/
    );
  });
});

describe('judgeSample', () => {
  const SINCE = new Date('2026-08-14T00:00:00Z');

  it('counts a sample measuring what its cell measures today', () => {
    expect(judgeSample(sample(), null)).toBe('qualifying');
  });

  it('discounts a sample whose measurement has been replaced', () => {
    expect(judgeSample(sample({ current: false }), null)).toBe('superseded');
  });

  it('discounts a qualifying sample collected before the cutoff', () => {
    expect(judgeSample(sample({ at: new Date('2026-08-13T23:59:59Z') }), SINCE)).toBe(
      'predates-cutoff'
    );
    expect(judgeSample(sample({ at: SINCE }), SINCE)).toBe('qualifying');
  });

  it('discounts an undatable sample only when a cutoff is set', () => {
    expect(judgeSample(sample({ at: null }), SINCE)).toBe('undatable');
    expect(judgeSample(sample({ at: null }), null)).toBe('qualifying');
  });
});

describe('planCell', () => {
  const options = { target: 10, since: null, force: false };

  it('asks only for the runs a cell is missing', () => {
    const planned = planCell(CELL, [sample({ runs: 6 })], options);

    expect(planned).toMatchObject({ qualifying: 6, deficit: 4 });
  });

  it('adds up samples spread across result directories', () => {
    const planned = planCell(
      CELL,
      [sample({ runs: 6 }), sample({ dir: 'later', runs: 4 })],
      options
    );

    expect(planned).toMatchObject({ qualifying: 10, deficit: 0 });
  });

  it('shows the full qualifying count of an over-collected cell, never a negative deficit', () => {
    expect(planCell(CELL, [sample({ runs: 14 })], options)).toMatchObject({
      qualifying: 14,
      deficit: 0,
    });
  });

  it('counts nothing when every sample is discounted, and says why', () => {
    const planned = planCell(CELL, [sample({ current: false, runs: 10 }), sample({ runs: 3 })], {
      ...options,
      since: new Date('2026-08-20T00:00:00Z'),
    });

    expect(planned).toMatchObject({ qualifying: 0, deficit: 10 });
    expect(planned.discounted).toEqual({ superseded: 10, 'predates-cutoff': 3, undatable: 0 });
  });

  it('ignores what is on disk under force', () => {
    expect(planCell(CELL, [sample({ runs: 10 })], { ...options, force: true })).toMatchObject({
      qualifying: 0,
      deficit: 10,
    });
  });

  it('explains a deficit in terms of what it counted and what it threw out', () => {
    expect(explainDeficit(planCell(CELL, [sample({ runs: 6 })], options))).toBe(
      '6/10 runs already collected'
    );
    expect(explainDeficit(planCell(CELL, [], options))).toBe('no qualifying runs');
    expect(explainDeficit(planCell(CELL, [sample({ current: false })], options))).toBe(
      'no qualifying runs (discounting 10 superseded)'
    );
  });

  it('dims only the discounting note when a style is given', () => {
    const dimMarked: OutputStyle = {
      ...PLAIN_STYLE,
      dim: (s) => `[D]${s}[/D]`,
    };
    expect(explainDeficit(planCell(CELL, [sample({ current: false })], options), dimMarked)).toBe(
      'no qualifying runs[D] (discounting 10 superseded)[/D]'
    );
    expect(explainDeficit(planCell(CELL, [sample({ runs: 6 })], options), dimMarked)).toBe(
      '6/10 runs already collected'
    );
  });
});

describe('planBatches', () => {
  function cell(experiment: string, evalName: string, deficit: number): CellPlan {
    return {
      experiment,
      evalName,
      target: 10,
      qualifying: 10 - deficit,
      deficit,
      discounted: { superseded: 0, 'predates-cutoff': 0, undatable: 0 },
    };
  }

  it('packs cells of equal deficit up to parallelMax', () => {
    const batches = planBatches(
      [cell('a', '701', 5), cell('b', '701', 5), cell('c', '701', 5), cell('d', '701', 5)],
      ['701'],
      20
    );

    expect(batches).toEqual([
      { index: 1, evalName: '701', experiments: ['a', 'b', 'c', 'd'], runs: 5, parallel: 20 },
    ]);
  });

  // One invocation carries a single --runs, so mixed deficits cannot share it.
  it('splits cells of differing deficits into their own batches, deepest first', () => {
    const batches = planBatches([cell('a', '701', 4), cell('b', '701', 10)], ['701'], 20);

    expect(batches.map((batch) => [batch.experiments, batch.runs])).toEqual([
      [['b'], 10],
      [['a'], 4],
    ]);
  });

  it('never starts more sandboxes than parallelMax', () => {
    const batches = planBatches(
      [cell('a', '701', 10), cell('b', '701', 10), cell('c', '701', 10)],
      ['701'],
      20
    );

    expect(batches.map((batch) => batch.parallel)).toEqual([20, 10]);
  });

  it('skips cells that already have their full sample', () => {
    expect(planBatches([cell('a', '701', 0), cell('b', '701', 0)], ['701'], 20)).toEqual([]);
  });

  it('collects a deficit deeper than parallelMax in sequential waves', () => {
    const batches = planBatches([cell('a', '701', 10), cell('b', '701', 10)], ['701'], 5);

    expect(batches.map((batch) => [batch.experiments, batch.runs, batch.parallel])).toEqual([
      [['a'], 5, 5],
      [['a'], 5, 5],
      [['b'], 5, 5],
      [['b'], 5, 5],
    ]);
  });

  it('sizes a deficit remainder wave to what is left, not parallelMax', () => {
    const batches = planBatches([cell('a', '701', 7)], ['701'], 5);

    expect(batches.map((batch) => [batch.runs, batch.parallel])).toEqual([
      [5, 5],
      [2, 2],
    ]);
  });

  it('keeps batches one eval wide, in registry order', () => {
    const batches = planBatches(
      [cell('a', '701', 10), cell('a', '702', 10), cell('b', '701', 10)],
      ['701', '702'],
      20
    );

    expect(batches.map((batch) => [batch.evalName, batch.experiments])).toEqual([
      ['701', ['a', 'b']],
      ['702', ['a']],
    ]);
  });

  it('numbers batches from 1, across evals', () => {
    const batches = planBatches([cell('a', '701', 10), cell('a', '702', 10)], ['701', '702'], 20);

    expect(batches.map((batch) => batch.index)).toEqual([1, 2]);
  });
});

describe('scanResourceSignals', () => {
  it('reads the host OOM killer out of a container exit', () => {
    const signals = scanResourceSignals('npm install failed with exit code 137');

    expect(signals).toEqual([
      { kind: 'memory', evidence: 'npm install failed with exit code 137' },
    ]);
  });

  it('recognises a full disk and a dead gateway account', () => {
    expect(scanResourceSignals('Error: ENOSPC: no space left on device')[0]!.kind).toBe('disk');
    expect(scanResourceSignals('AI Gateway: insufficient funds')[0]!.kind).toBe('billing');
  });

  it('reports each kind once, however many lines carry it', () => {
    const signals = scanResourceSignals('OOMKilled\nCannot allocate memory\nENOSPC');

    expect(signals.map((signal) => signal.kind)).toEqual(['memory', 'disk']);
  });

  // Ordinary eval failures are the measurement, not a fault.
  it('stays quiet on a normal failing run', () => {
    expect(scanResourceSignals('  ✗ 701-new-ui-flow run 3/10 failed (assertion)')).toEqual([]);
  });

  it('only stops the plan for conditions every later batch would hit', () => {
    expect(isPlanStoppingSignal({ kind: 'disk', evidence: '' })).toBe(true);
    expect(isPlanStoppingSignal({ kind: 'billing', evidence: '' })).toBe(true);
    expect(isPlanStoppingSignal({ kind: 'memory', evidence: '' })).toBe(false);
  });
});

describe('narrowedParallelMax', () => {
  it('halves, and reports the floor of one cell', () => {
    expect(narrowedParallelMax(20, 10)).toBe(10);
    expect(narrowedParallelMax(40, 5)).toBe(20);
    expect(narrowedParallelMax(10, 10)).toBeNull();
  });
});

describe('topUpCommand', () => {
  it('collects only the missing repetitions, forcing past the cache', () => {
    expect(
      topUpCommand({
        experiment: 'agentic-ref-cc-full-opus-high',
        evalName: '701-new-ui-flow',
        expected: 10,
        collected: 6,
      })
    ).toBe(
      'yarn eval:agentic-ref --experiments agentic-ref-cc-full-opus-high --evals 701-new-ui-flow --runs 4 --force'
    );
  });
});
