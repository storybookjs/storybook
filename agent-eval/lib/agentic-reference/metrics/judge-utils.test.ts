import { describe, expect, it } from 'vitest';

import { addUsage, usdOf } from './judge-utils.ts';

import type { JudgeUsage } from './ds-misuse/judge.ts';

function usage(overrides: Partial<JudgeUsage> = {}): JudgeUsage {
  return {
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    ...overrides,
  };
}

describe('usdOf', () => {
  it('prices a usage record against the default judge model (claude-opus-5)', () => {
    const cost = usdOf(
      usage({ inputTokens: 1_000_000, cacheReadTokens: 1_000_000, outputTokens: 1_000_000 })
    );
    expect(cost).toBeCloseTo(5 + 0.5 + 25, 6);
  });

  it('prices a usage record explicitly against claude-opus-5', () => {
    const cost = usdOf(usage({ inputTokens: 1_000_000 }), 'claude-opus-5');
    expect(cost).toBeCloseTo(5, 6);
  });

  it('still prices the superseded claude-opus-4-8 model', () => {
    const cost = usdOf(usage({ inputTokens: 1_000_000 }), 'claude-opus-4-8');
    expect(cost).toBeCloseTo(5, 6);
  });

  it('rejects a model with no declared pricing', () => {
    expect(() => usdOf(usage(), 'some-future-model')).toThrow(/no USD_PER_MTOK pricing/);
  });
});

describe('addUsage', () => {
  it('accumulates a usage record into a running total in place', () => {
    const total = usage({
      inputTokens: 1,
      cacheReadTokens: 2,
      cacheWriteTokens: 3,
      outputTokens: 4,
    });
    addUsage(
      total,
      usage({ inputTokens: 10, cacheReadTokens: 20, cacheWriteTokens: 30, outputTokens: 40 })
    );
    expect(total).toEqual(
      usage({ inputTokens: 11, cacheReadTokens: 22, cacheWriteTokens: 33, outputTokens: 44 })
    );
  });
});
