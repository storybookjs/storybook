// Single source of truth for Anthropic list prices, USD per 1M tokens.
// Current as of 2026-05-13. Zero dependencies on purpose: every cost
// consumer (budget gate + realized cost in agent-dispatch.ts, telemetry
// in ci/append-telemetry.ts, vision estimate in verify-evidence-check.ts)
// imports from here so the table cannot drift across modules.
//
// Tiers: i=input, o=output, cr=cache read, cw5=5-minute cache write,
// cw1=1-hour cache write.

export interface ModelPrice {
  i: number;
  o: number;
  cr: number;
  cw5: number;
  cw1: number;
}

export const MODEL_PRICES_USD_PER_1M: Record<string, ModelPrice> = {
  'claude-opus-4-7': { i: 5.0, o: 25.0, cr: 0.5, cw5: 6.25, cw1: 10.0 },
  'claude-opus-4-6': { i: 5.0, o: 25.0, cr: 0.5, cw5: 6.25, cw1: 10.0 },
  'claude-opus-4-5': { i: 5.0, o: 25.0, cr: 0.5, cw5: 6.25, cw1: 10.0 },
  'claude-opus-4-1': { i: 15.0, o: 75.0, cr: 1.5, cw5: 18.75, cw1: 30.0 },
  'claude-opus-4': { i: 15.0, o: 75.0, cr: 1.5, cw5: 18.75, cw1: 30.0 },
  'claude-sonnet-4-6': { i: 3.0, o: 15.0, cr: 0.3, cw5: 3.75, cw1: 6.0 },
  'claude-sonnet-4-5': { i: 3.0, o: 15.0, cr: 0.3, cw5: 3.75, cw1: 6.0 },
  'claude-sonnet-4': { i: 3.0, o: 15.0, cr: 0.3, cw5: 3.75, cw1: 6.0 },
  'claude-haiku-4-5': { i: 1.0, o: 5.0, cr: 0.1, cw5: 1.25, cw1: 2.0 },
  'claude-haiku-3-5': { i: 0.8, o: 4.0, cr: 0.08, cw5: 1.0, cw1: 1.6 },
  'claude-haiku-3': { i: 0.25, o: 1.25, cr: 0.03, cw5: 0.3, cw1: 0.5 },
};

// Strip the trailing -YYYYMMDD date suffix Anthropic ships alongside the
// rolling alias (e.g. claude-haiku-4-5-20251001 → claude-haiku-4-5).
export function modelKey(model: string): string {
  return model.replace(/-\d{8}$/, '');
}

// Unknown models fall back to the most expensive current tier (opus-4-7)
// so a missing entry over-estimates cost and trips budget gates rather
// than silently under-charging.
export function getModelPrice(model: string): ModelPrice {
  return MODEL_PRICES_USD_PER_1M[modelKey(model)] ?? MODEL_PRICES_USD_PER_1M['claude-opus-4-7'];
}
