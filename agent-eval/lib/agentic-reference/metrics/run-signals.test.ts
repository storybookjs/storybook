import { describe, expect, it } from 'vitest';

import goldenResult from '../__fixtures__/golden-run/result.json' with { type: 'json' };
import { readCost, readSpeed } from './run-signals.ts';

describe('readSpeed', () => {
  it('reads duration and turns from the golden run', () => {
    expect(readSpeed(goldenResult)).toEqual({ durationSeconds: 403.365, turns: 12 });
  });

  it('nulls missing fields rather than throwing', () => {
    expect(readSpeed({})).toEqual({ durationSeconds: null, turns: null });
    expect(readSpeed(null)).toEqual({ durationSeconds: null, turns: null });
  });
});

describe('readCost', () => {
  it('reads usage and derives the cache hit rate from the golden run', () => {
    const cost = readCost(goldenResult);
    expect(cost.inputTokens).toBe(53157);
    expect(cost.cacheWriteTokens).toBe(147365);
    expect(cost.cacheReadTokens).toBe(999884);
    expect(cost.outputTokens).toBe(8239);
    expect(cost.totalTokens).toBe(1208645);
    expect(cost.estimatedCostUsd).toBe(1.89273325);
    expect(cost.totalToolCalls).toBe(25);
    // cacheRead / (input + cacheWrite + cacheRead); output is excluded because
    // caching applies only to the input side.
    expect(cost.cacheHitRate).toBeCloseTo(0.833, 4);
  });

  it('nulls the cache hit rate when there are no input-side tokens', () => {
    const cost = readCost({
      metadata: {
        usage: {
          inputTokens: 0,
          cacheWriteTokens: 0,
          cacheReadTokens: 0,
          outputTokens: 5,
          totalTokens: 5,
        },
      },
    });
    expect(cost.cacheHitRate).toBeNull();
  });

  it('nulls every field when usage is absent', () => {
    const cost = readCost({});
    expect(cost.totalTokens).toBeNull();
    expect(cost.cacheHitRate).toBeNull();
    expect(cost.estimatedCostUsd).toBeNull();
  });

  it('carries the per-tool call breakdown through', () => {
    expect(readCost(goldenResult).toolCalls).toMatchObject({ file_read: 4, shell: 17 });
  });
});
