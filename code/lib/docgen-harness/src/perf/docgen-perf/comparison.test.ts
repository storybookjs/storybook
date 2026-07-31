import { describe, expect, it } from 'vitest';

import {
  assessWork,
  comparePairedTimings,
  computePairedEffect,
  createComparisonPlan,
  deriveComparisonSeed,
  executeComparisonPlan,
  evaluateBudget,
  type PairedComparison,
  type PairedEffect,
  studentTCritical95,
  type WorkProfile,
} from './comparison.ts';

const work = (version = '1.0.0'): WorkProfile => ({
  version,
  cold: { members: 20, opaqueTypes: 0 },
  warm: [
    { save: 1, members: 21, opaqueTypes: 0 },
    { save: 2, members: 22, opaqueTypes: 1 },
  ],
});

describe('createComparisonPlan', () => {
  it('is deterministic, adjacent, and exactly AB/BA balanced', () => {
    const options = { seed: 'ci-123', pair: 'vue-version', scenario: 'flat', repetitions: 10 };
    const first = createComparisonPlan(options);
    const second = createComparisonPlan(options);

    expect(first).toEqual(second);
    expect(first.blocks).toHaveLength(10);
    expect(first.blocks.map(({ block }) => block)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(first.blocks.filter(({ order }) => order[0] === 'control')).toHaveLength(5);
    expect(first.blocks.filter(({ order }) => order[0] === 'candidate')).toHaveLength(5);
    for (const { order } of first.blocks) {
      expect(new Set(order)).toEqual(new Set(['control', 'candidate']));
    }
    for (let block = 0; block < first.blocks.length; block += 2) {
      expect(
        first.blocks
          .slice(block, block + 2)
          .map(({ order }) => order[0])
          .sort()
      ).toEqual(['candidate', 'control']);
    }
  });

  it('derives a stable independent seed for each pair and scenario', () => {
    const seed = deriveComparisonSeed(42, 'vue-version', 'flat');
    expect(seed).toBe(deriveComparisonSeed(42, 'vue-version', 'flat'));
    expect(seed).not.toBe(deriveComparisonSeed(42, 'vue-version', 'workspace'));
    expect(seed).not.toBe(deriveComparisonSeed(42, 'react', 'flat'));
  });

  it.each([0, 8, 9, 11, 10.5])('rejects invalid repetition count %s', (repetitions) => {
    expect(() =>
      createComparisonPlan({ seed: 1, pair: 'vue', scenario: 'flat', repetitions })
    ).toThrow('even repetition count of at least 10');
  });
});

describe('executeComparisonPlan', () => {
  it('executes exact adjacent block order and retains side identity', async () => {
    const plan = createComparisonPlan({
      seed: 42,
      pair: 'vue-version',
      scenario: 'flat',
      repetitions: 10,
    });
    const calls: string[] = [];
    const blocks = await executeComparisonPlan(plan, async (side, block) => {
      calls.push(`${block}:${side}`);
      return `${side}-${block}`;
    });
    expect(calls).toEqual(
      plan.blocks.flatMap(({ block, order }) => order.map((side) => `${block}:${side}`))
    );
    expect(blocks[0]).toMatchObject({
      block: 1,
      control: 'control-1',
      candidate: 'candidate-1',
    });
  });

  it('does not emit a partial block after a side fails', async () => {
    const plan = createComparisonPlan({
      seed: 1,
      pair: 'vue-version',
      scenario: 'flat',
      repetitions: 10,
    });
    const published: unknown[] = [];
    await expect(
      executeComparisonPlan(plan, async (side, block) => {
        if (block === 2 && side === plan.blocks[1].order[1]) {
          throw new Error('side failed');
        }
        published.push({ side, block });
        return 1;
      })
    ).rejects.toThrow('side failed');
    expect(published.filter((value) => (value as { block: number }).block === 2)).toHaveLength(1);
  });
});

describe('assessWork', () => {
  it('requires matching cold and ordered warm member/opaque signatures', () => {
    expect(assessWork(work(), work())).toEqual({
      status: 'same-work',
      reason: 'matching-signatures',
    });

    const reordered = work();
    reordered.warm = [...reordered.warm!].reverse();
    expect(assessWork(work(), reordered)).toMatchObject({ status: 'different-work' });

    const mislabeled = work();
    mislabeled.warm = [
      { save: 2, members: 21, opaqueTypes: 0 },
      { save: 1, members: 22, opaqueTypes: 1 },
    ];
    const labeled = work();
    labeled.warm = [
      { save: 1, members: 21, opaqueTypes: 0 },
      { save: 2, members: 22, opaqueTypes: 1 },
    ];
    expect(assessWork(labeled, mislabeled)).toMatchObject({
      status: 'different-work',
      reason: 'different-warm-signature',
    });
  });

  it('distinguishes unequal, unknown, and colliding-version work', () => {
    const different = work();
    different.cold = { members: 19, opaqueTypes: 0 };
    expect(assessWork(work(), different).status).toBe('different-work');

    const unknown = work();
    unknown.warm = [
      { save: 1, members: 21 },
      { save: 2, members: 22, opaqueTypes: 1 },
    ];
    expect(assessWork(work(), unknown).status).toBe('unknown-work');

    expect(assessWork(work('3.3.9'), work('3.3.9'), { versionsMustDiffer: true })).toEqual({
      status: 'same-version',
      reason: 'matching-version',
    });
    expect(
      assessWork({ ...work(), version: undefined }, work('3.3.8'), { versionsMustDiffer: true })
        .status
    ).toBe('unknown-work');

    expect(assessWork({ ...work(), warm: [] }, { ...work(), warm: [] }).status).toBe(
      'unknown-work'
    );
  });

  it('does not calculate an effect unless work is proven equal', () => {
    const timings = Array.from({ length: 10 }, (_, block) => ({
      block: block + 1,
      controlMs: 100,
      candidateMs: 120,
    }));
    const candidateWork = work();
    candidateWork.cold = { members: 21, opaqueTypes: 0 };

    expect(
      comparePairedTimings({ controlWork: work(), candidateWork, timings, expectedPairs: 10 })
    ).toEqual({
      work: { status: 'different-work', reason: 'different-cold-signature' },
    });
  });

  it('validates cold and warm work independently', () => {
    const timings = Array.from({ length: 10 }, (_, block) => ({
      block: block + 1,
      controlMs: 100,
      candidateMs: 105,
    }));
    const coldMismatch = work();
    coldMismatch.cold = { members: 21, opaqueTypes: 0 };

    expect(
      comparePairedTimings({
        controlWork: work(),
        candidateWork: coldMismatch,
        timings,
        expectedPairs: 10,
        metric: 'cold',
      })
    ).not.toHaveProperty('effect');
    expect(
      comparePairedTimings({
        controlWork: work(),
        candidateWork: coldMismatch,
        timings,
        expectedPairs: 10,
        metric: 'warm',
      }).effect?.status
    ).toBe('measured');

    const warmMismatch = work();
    warmMismatch.warm = [
      { save: 1, members: 99 },
      { save: 2, members: 22, opaqueTypes: 1 },
    ];
    expect(
      comparePairedTimings({
        controlWork: work(),
        candidateWork: warmMismatch,
        timings,
        expectedPairs: 10,
        metric: 'cold',
      }).effect?.status
    ).toBe('measured');
    expect(
      comparePairedTimings({
        controlWork: work(),
        candidateWork: warmMismatch,
        timings,
        expectedPairs: 10,
        metric: 'warm',
      })
    ).not.toHaveProperty('effect');
  });
});

describe('computePairedEffect', () => {
  it('uses paired candidate/control log ratios and a 95% Student-t interval', () => {
    const ratios = [0.9, 0.95, 1, 1.05, 1.1, 0.92, 0.98, 1.02, 1.08, 1.12];
    const result = computePairedEffect(
      ratios.map((ratio, block) => ({
        block: block + 1,
        controlMs: 100,
        candidateMs: 100 * ratio,
      })),
      { expectedPairs: 10 }
    );

    expect(result.status).toBe('measured');
    const effect = result as PairedEffect;
    const expectedLogMean = ratios.reduce((sum, ratio) => sum + Math.log(ratio), 0) / ratios.length;
    expect(effect.meanLogRatio).toBeCloseTo(expectedLogMean, 12);
    expect(effect.candidateOverControl.estimate).toBeCloseTo(Math.exp(expectedLogMean), 12);
    expect(effect.criticalValue95).toBeCloseTo(2.2621571628, 10);
    expect(effect.candidateOverControl.lower95).toBeLessThan(effect.candidateOverControl.estimate);
    expect(effect.candidateOverControl.upper95).toBeGreaterThan(
      effect.candidateOverControl.estimate
    );
  });

  it('preserves candidate/control direction', () => {
    const result = computePairedEffect([
      { block: 1, controlMs: 100, candidateMs: 200 },
      { block: 2, controlMs: 50, candidateMs: 100 },
    ]);
    expect(result.status).toBe('measured');
    const effect = result as PairedEffect;
    expect(effect.candidateOverControl.estimate).toBeCloseTo(2, 12);
    expect(effect.candidateOverControl.lower95).toBeCloseTo(2, 12);
    expect(effect.candidateOverControl.upper95).toBeCloseTo(2, 12);
  });

  it.each([
    ['incomplete-data', [{ block: 1, controlMs: 1, candidateMs: 1 }], { expectedPairs: 2 }],
    [
      'incomplete-data',
      [
        { block: 1, controlMs: 1, candidateMs: 1 },
        { block: 1, controlMs: 1, candidateMs: 1 },
      ],
      {},
    ],
    [
      'incomplete-data',
      [
        { block: 1, controlMs: 1, candidateMs: 1 },
        { block: 3, controlMs: 1, candidateMs: 1 },
      ],
      {},
    ],
    [
      'incomplete-data',
      [
        { block: 1, controlMs: 1, candidateMs: 1 },
        { block: 2, controlMs: 1 },
      ],
      {},
    ],
    [
      'nonfinite-data',
      [
        { block: 1, controlMs: 1, candidateMs: Number.NaN },
        { block: 2, controlMs: 1, candidateMs: 1 },
      ],
      {},
    ],
    [
      'nonpositive-data',
      [
        { block: 1, controlMs: 1, candidateMs: 0 },
        { block: 2, controlMs: 1, candidateMs: 1 },
      ],
      {},
    ],
  ] as const)('rejects %s', (reason, timings, options) => {
    expect(computePairedEffect(timings, options)).toEqual({ status: 'invalid', reason });
  });

  it('uses a valid asymptotic Student-t critical value beyond the table', () => {
    expect(studentTCritical95(100)).toBeCloseTo(1.983971518, 8);
  });
});

describe('evaluateBudget', () => {
  const comparison = (lower95: number, upper95: number, pairs = 10): PairedComparison => ({
    work: { status: 'same-work', reason: 'matching-signatures' },
    effect: {
      status: 'measured',
      pairs,
      logRatios: [],
      meanLogRatio: Math.log((lower95 + upper95) / 2),
      standardError: 0,
      criticalValue95: studentTCritical95(Math.max(1, pairs - 1)),
      candidateOverControl: {
        estimate: (lower95 + upper95) / 2,
        lower95,
        upper95,
      },
    },
  });

  it('keeps descriptive and smoke runs out of timing gates', () => {
    expect(evaluateBudget(comparison(0.9, 1.3), { repetitions: 10 }).status).toBe('not-configured');
    expect(
      evaluateBudget(comparison(1.3, 1.4), {
        repetitions: 10,
        maxRegression: 0.1,
        smoke: true,
      })
    ).toMatchObject({
      status: 'smoke',
      maxRegression: 0.1,
      maxCandidateOverControl: 1.1,
    });

    expect(
      evaluateBudget(
        { work: { status: 'unknown-work', reason: 'missing-signature' } },
        { repetitions: 10, maxRegression: 0.1, smoke: true }
      )
    ).toMatchObject({ status: 'invalid-gate', reason: 'work-not-comparable' });
  });

  it('only reports regression when the whole interval exceeds the limit', () => {
    expect(
      evaluateBudget(comparison(1.11, 1.2), { repetitions: 10, maxRegression: 0.1 }).status
    ).toBe('regression');
    expect(
      evaluateBudget(comparison(1.05, 1.15), { repetitions: 10, maxRegression: 0.1 }).status
    ).toBe('inconclusive');
    expect(
      evaluateBudget(comparison(0.95, 1.1), { repetitions: 10, maxRegression: 0.1 }).status
    ).toBe('within-budget');
  });

  it('rejects malformed or unjustified gates', () => {
    expect(evaluateBudget(comparison(1, 1), { repetitions: 9, maxRegression: 0.1 })).toMatchObject({
      status: 'invalid-gate',
      reason: 'invalid-repetition-count',
    });
    expect(
      evaluateBudget(comparison(1, 1), { repetitions: 10, maxRegression: Number.NaN })
    ).toMatchObject({ status: 'invalid-gate', reason: 'invalid-budget' });
    expect(
      evaluateBudget(
        { work: { status: 'unknown-work', reason: 'missing-signature' } },
        { repetitions: 10, maxRegression: 0.1 }
      )
    ).toMatchObject({ status: 'invalid-gate', reason: 'work-not-comparable' });
    expect(
      evaluateBudget(comparison(1, 1, 8), { repetitions: 10, maxRegression: 0.1 })
    ).toMatchObject({ status: 'invalid-gate', reason: 'incomplete-effect' });
  });
});
