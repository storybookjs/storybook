import { afterEach, describe, expect, it } from 'vitest';

import {
  MODEL_ID_MAP,
  VerifyCostBudgetError,
  assertWithinCostBudget,
  computeRealizedCostUsd,
  resolveModelId,
} from './agent-dispatch.ts';
import { MODEL_PRICES_USD_PER_1M, getModelPrice, modelKey } from './model-pricing.ts';

// EPIC-5.2 — budget gate fires over the cap / passes under it, resolveModelId
// round-trips the model-id map, and the pricing constants are spot-checked
// against model-pricing.ts to catch a digit transposition.

describe('agent-dispatch budget gate (assertWithinCostBudget)', () => {
  const ORIGINAL_ENV = process.env.VERIFY_MAX_COST_USD;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.VERIFY_MAX_COST_USD;
    else process.env.VERIFY_MAX_COST_USD = ORIGINAL_ENV;
  });

  it('passes under the cap for a small prompt against the default $2 cap', () => {
    delete process.env.VERIFY_MAX_COST_USD;
    // ~40 chars -> ~10 input tokens. opus-4-7: input $5/MTok, output $25/MTok,
    // budget output estimate 2048 tokens -> ~$0.0512 << $2.
    expect(() => assertWithinCostBudget('a'.repeat(40), 'claude-opus-4-7')).not.toThrow();
  });

  it('fires when projected cost exceeds the cap (huge prompt, default cap)', () => {
    delete process.env.VERIFY_MAX_COST_USD;
    // 8M chars -> ~2M input tokens * $5/MTok = ~$10 input alone >> $2 cap.
    const hugePrompt = 'x'.repeat(8_000_000);
    expect(() => assertWithinCostBudget(hugePrompt, 'claude-opus-4-7')).toThrowError(
      VerifyCostBudgetError
    );
    try {
      assertWithinCostBudget(hugePrompt, 'claude-opus-4-7');
    } catch (err) {
      expect((err as Error).message).toMatch(/exceeds budget cap \$2\.00/);
    }
  });

  it('fires precisely at the boundary when the env-overridden cap is set just below cost', () => {
    // Deterministic: known prompt length -> known estimated cost.
    const prompt = 'y'.repeat(4000); // ceil(4000/4) = 1000 input tokens
    const price = MODEL_PRICES_USD_PER_1M['claude-haiku-4-5']; // i:1.0 o:5.0 per 1M
    const expectedCost = 1000 * (price.i / 1_000_000) + 2048 * (price.o / 1_000_000);
    // expectedCost = 1000*1e-6 + 2048*5e-6 = 0.001 + 0.01024 = 0.01124

    // Cap just BELOW expected -> must fire.
    process.env.VERIFY_MAX_COST_USD = (expectedCost - 0.0001).toFixed(6);
    expect(() => assertWithinCostBudget(prompt, 'claude-haiku-4-5')).toThrowError(
      VerifyCostBudgetError
    );

    // Cap just ABOVE expected -> must pass.
    process.env.VERIFY_MAX_COST_USD = (expectedCost + 0.0001).toFixed(6);
    expect(() => assertWithinCostBudget(prompt, 'claude-haiku-4-5')).not.toThrow();
  });

  it('rejects a non-numeric / negative VERIFY_MAX_COST_USD override', () => {
    process.env.VERIFY_MAX_COST_USD = 'not-a-number';
    expect(() => assertWithinCostBudget('hi', 'claude-opus-4-7')).toThrowError(
      /must be a non-negative number/
    );
    process.env.VERIFY_MAX_COST_USD = '-1';
    expect(() => assertWithinCostBudget('hi', 'claude-opus-4-7')).toThrowError(
      /must be a non-negative number/
    );
  });

  it('HARD-fails (no lenient opus fallback) for an unpriced resolved model id', () => {
    // getPricing in agent-dispatch refuses to run an uncosted model — unlike
    // model-pricing.getModelPrice which would silently fall back to opus.
    expect(() => assertWithinCostBudget('hi', 'totally-unknown-model')).toThrowError(
      /no pricing entry for model id/
    );
  });
});

describe('resolveModelId round-trips the model-id map', () => {
  it('maps every internal hint key to its public id', () => {
    for (const [hint, publicId] of Object.entries(MODEL_ID_MAP)) {
      expect(resolveModelId(hint)).toBe(publicId);
    }
  });

  it('pins the eval-relevant 1m hint to the bare opus public id', () => {
    expect(resolveModelId('claude-opus-4-7[1m]')).toBe('claude-opus-4-7');
    expect(MODEL_ID_MAP['claude-opus-4-7[1m]']).toBe('claude-opus-4-7');
  });

  it('passes through an already-public dated id (forward compatible)', () => {
    expect(resolveModelId('claude-opus-4-9-20271231')).toBe('claude-opus-4-9-20271231');
  });

  it('falls back to the canonical opus id for an unknown non-dated hint', () => {
    expect(resolveModelId('garbage-hint')).toBe(MODEL_ID_MAP['claude-opus-4-7[1m]']);
    expect(resolveModelId('garbage-hint')).toBe('claude-opus-4-7');
  });
});

describe('model-pricing constants spot-check (digit-transposition guard)', () => {
  // Assert SPECIFIC known values so e.g. opus output 25.0 -> 52.0, or
  // haiku-3 input 0.25 -> 0.52, is caught immediately.
  it('opus-4-7 prices are exactly the published tier', () => {
    expect(MODEL_PRICES_USD_PER_1M['claude-opus-4-7']).toEqual({
      i: 5.0,
      o: 25.0,
      cr: 0.5,
      cw5: 6.25,
      cw1: 10.0,
    });
  });

  it('sonnet-4-6 and haiku-4-5 input/output prices are exact', () => {
    expect(MODEL_PRICES_USD_PER_1M['claude-sonnet-4-6'].i).toBe(3.0);
    expect(MODEL_PRICES_USD_PER_1M['claude-sonnet-4-6'].o).toBe(15.0);
    expect(MODEL_PRICES_USD_PER_1M['claude-haiku-4-5'].i).toBe(1.0);
    expect(MODEL_PRICES_USD_PER_1M['claude-haiku-4-5'].o).toBe(5.0);
  });

  it('opus-4-1 legacy tier is 15/75 (not transposed with the 4-5+ tier)', () => {
    expect(MODEL_PRICES_USD_PER_1M['claude-opus-4-1'].i).toBe(15.0);
    expect(MODEL_PRICES_USD_PER_1M['claude-opus-4-1'].o).toBe(75.0);
    // The newer opus-4-5+ tier must be the CHEAPER 5/25, distinct from 4-1.
    expect(MODEL_PRICES_USD_PER_1M['claude-opus-4-5'].i).toBe(5.0);
  });

  it('haiku-3 micro-tier digits are not transposed (0.25 / 1.25 / 0.03)', () => {
    expect(MODEL_PRICES_USD_PER_1M['claude-haiku-3']).toEqual({
      i: 0.25,
      o: 1.25,
      cr: 0.03,
      cw5: 0.3,
      cw1: 0.5,
    });
  });

  it('modelKey strips the trailing -YYYYMMDD date suffix', () => {
    expect(modelKey('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5');
    expect(modelKey('claude-opus-4-7')).toBe('claude-opus-4-7');
  });

  it('getModelPrice falls back to the most-expensive current tier for unknowns', () => {
    expect(getModelPrice('no-such-model')).toEqual(MODEL_PRICES_USD_PER_1M['claude-opus-4-7']);
  });
});

describe('computeRealizedCostUsd uses the single-source pricing table', () => {
  it('computes input*price.i + output*price.o per 1M for a known model', () => {
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_creation: null,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    } as never;
    // opus-4-7: 1M*5/1M + 1M*25/1M = 30 USD
    expect(computeRealizedCostUsd('claude-opus-4-7', usage)).toBeCloseTo(30, 6);
  });
});
