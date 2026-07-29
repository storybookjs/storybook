import { describe, expect, it } from 'vitest';

import { CONTROL_PAIRS, computeRatios, engineOrderForRep } from './ratios.ts';
import { type EngineId, type EngineResult, NOT_APPLICABLE, type ScenarioResult } from './types.ts';

function scenario(
  cold: number,
  warm: number,
  members?: [number, number],
  coldOpaqueTypes?: number
): ScenarioResult {
  return {
    params: {},
    coldMembers: members?.[0],
    warmMembers: members?.[1],
    coldOpaqueTypes,
    metrics: {
      coldExtractionMs: { status: 'measured', samples: [cold], median: cold },
      warmExtractionMs: { status: 'measured', samples: [warm], median: warm },
      wholeProjectScanMs: NOT_APPLICABLE,
      peakTransientMb: NOT_APPLICABLE,
      retainedGrowthMb: NOT_APPLICABLE,
      retainedSlopeMbPerSave: NOT_APPLICABLE,
    },
  };
}

function measured(scenarios: Record<string, ScenarioResult>): EngineResult {
  return { status: 'measured', scenarios };
}

describe('engineOrderForRep', () => {
  const engines: EngineId[] = ['react-legacy', 'react-osa', 'vue-docgen-api', 'vue-component-meta'];

  it('keeps the listed order on odd repetitions', () => {
    expect(engineOrderForRep(engines, 1)).toEqual(engines);
    expect(engineOrderForRep(engines, 3)).toEqual(engines);
  });

  it('swaps every control pair on even repetitions', () => {
    expect(engineOrderForRep(engines, 2)).toEqual([
      'react-osa',
      'react-legacy',
      'vue-component-meta',
      'vue-docgen-api',
    ]);
  });

  it('leaves a pair alone when only one of its sides is running', () => {
    expect(engineOrderForRep(['react-legacy', 'compodoc'], 2)).toEqual(['react-legacy', 'compodoc']);
  });

  it('does not mutate its input', () => {
    const input: EngineId[] = ['react-legacy', 'react-osa'];
    engineOrderForRep(input, 2);
    expect(input).toEqual(['react-legacy', 'react-osa']);
  });

  it('gives each side of a pair the first slot at least once across the pinned five', () => {
    const firsts = [1, 2, 3, 4, 5].map((rep) => engineOrderForRep(engines, rep)[0]);
    expect(new Set(firsts)).toEqual(new Set(['react-legacy', 'react-osa']));
  });
});

describe('computeRatios', () => {
  it('divides the legacy median by the new engine median', () => {
    const ratios = computeRatios({
      'react-legacy': measured({ default: scenario(400, 40) }),
      'react-osa': measured({ default: scenario(100, 20) }),
    });
    expect(ratios.react.default.cold).toBe(4);
    expect(ratios.react.default.warm).toBe(2);
  });

  it('produces nothing when one side did not measure', () => {
    expect(
      computeRatios({
        'react-legacy': measured({ default: scenario(400, 40) }),
        'react-osa': { status: 'failed', reason: 'boom' },
      })
    ).toEqual({});
  });

  it('produces nothing when one side was skipped', () => {
    expect(
      computeRatios({
        'vue-docgen-api': measured({ flat: scenario(20, 2) }),
        'vue-component-meta': { status: 'skipped', reason: 'not installed' },
      })
    ).toEqual({});
  });

  it('pairs scenarios by name and ignores ones only one side ran', () => {
    const ratios = computeRatios({
      'vue-docgen-api': measured({ flat: scenario(20, 2), workspace: scenario(30, 3) }),
      'vue-component-meta': measured({ flat: scenario(400, 40) }),
    });
    expect(Object.keys(ratios.vue)).toEqual(['flat']);
  });

  it('marks a pair like-for-like when both documented the same members', () => {
    const ratios = computeRatios({
      'vue-docgen-api': measured({ flat: scenario(20, 2, [50, 5]) }),
      'vue-component-meta': measured({ flat: scenario(400, 40, [50, 5]) }),
    });
    expect(ratios.vue.flat.coldComparability).toBe('like-for-like');
  });

  it('marks a pair not like-for-like when the member counts disagree', () => {
    // vue-docgen-api does not resolve tsconfig `paths` aliases, so it documents a fraction of what
    // vue-component-meta does and is fast for the wrong reason.
    const ratios = computeRatios({
      'vue-docgen-api': measured({ flat: scenario(23, 1, [6, 0]) }),
      'vue-component-meta': measured({ flat: scenario(425, 40, [320, 32]) }),
    });
    expect(ratios.vue.flat).toMatchObject({
      coldComparability: 'next-documents-more',
      warmComparability: 'next-documents-more',
      legacyColdMembers: 6,
      nextColdMembers: 320,
      legacyWarmMembers: 0,
      nextWarmMembers: 32,
    });
  });

  it('separates a pair that documented more from one that documented less', () => {
    // Same numbers, opposite meaning: the side that documented less is fast for the wrong reason,
    // while the side that documented more has a ratio that undersells it. A boolean lost this.
    const fewer = computeRatios({
      'vue-docgen-api': measured({ flat: scenario(400, 40, [320, 32]) }),
      'vue-component-meta': measured({ flat: scenario(23, 1, [6, 0]) }),
    });
    expect(fewer.vue.flat.coldComparability).toBe('next-documents-less');
  });

  it('catches a pair that documented the same members off different resolution work', () => {
    // The Angular trap: an engine that records a type's name without looking through it documents
    // exactly as many members as one that expanded the chain, so counts alone read as clean.
    const ratios = computeRatios({
      'vue-docgen-api': measured({ flat: scenario(400, 40, [90, 9], 0) }),
      'vue-component-meta': measured({ flat: scenario(100, 10, [90, 9], 10) }),
    });
    expect(ratios.vue.flat.coldComparability).toBe('next-resolves-less');
    expect(ratios.vue.flat.warmComparability).toBe('like-for-like');
  });

  it('reports comparability unknown when the engines report no member counts', () => {
    // Unknown is not the same claim as unequal; a missing count must not read as agreement.
    const ratios = computeRatios({
      'react-legacy': measured({ default: scenario(400, 40) }),
      'react-osa': measured({ default: scenario(100, 20) }),
    });
    expect(ratios.react.default.coldComparability).toBe('unknown');
  });

  it('names every pair it knows uniquely', () => {
    const names = CONTROL_PAIRS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
