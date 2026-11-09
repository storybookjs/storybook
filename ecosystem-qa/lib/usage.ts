import { readFileSync } from 'node:fs';

import { MODEL_PRICING } from '../../agent-eval/lib/usage.ts';
import type { Engine, RunResultFile } from './types.ts';

interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type PriceTable = typeof MODEL_PRICING;

const parseLine = (line: string): Record<string, any> | undefined => {
  if (!line.startsWith('{')) {
    return undefined;
  }
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
};

interface ClaudeTotals extends Tokens {
  usd: number;
}

// Claude Code's final `result` line carries the run's totals and its own cost figure per model.
// It is the authority; the per-message sum below undercounts output tokens on streamed replies.
const claudeResultTotals = (lines: string[]): ClaudeTotals | undefined => {
  const result = lines.map(parseLine).findLast((event) => event?.type === 'result');
  const perModel = result?.model_usage_since_last_result;
  if (!perModel || typeof perModel !== 'object') {
    return undefined;
  }
  const totals: ClaudeTotals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    usd: 0,
  };
  for (const usage of Object.values(perModel) as Record<string, number>[]) {
    totals.inputTokens += usage.inputTokens ?? 0;
    totals.outputTokens += usage.outputTokens ?? 0;
    totals.cacheReadTokens += usage.cacheReadInputTokens ?? 0;
    totals.cacheWriteTokens += usage.cacheCreationInputTokens ?? 0;
    totals.usd += usage.costUSD ?? 0;
  }
  return totals;
};

// Fallback when the run ended without a `result` line: Claude Code repeats a call's usage on every
// stream line split from that call, and the last copy is final.
const claudeTokens = (lines: string[]): Tokens => {
  const byMessage = new Map<string, Record<string, number>>();
  for (const event of lines.map(parseLine)) {
    const id = event?.message?.id;
    if (event?.type === 'assistant' && typeof id === 'string' && event.message.usage) {
      byMessage.set(id, event.message.usage);
    }
  }
  const sum = (field: string) =>
    [...byMessage.values()].reduce((total, usage) => total + (usage[field] ?? 0), 0);
  return {
    inputTokens: sum('input_tokens'),
    outputTokens: sum('output_tokens'),
    cacheReadTokens: sum('cache_read_input_tokens'),
    cacheWriteTokens: sum('cache_creation_input_tokens'),
  };
};

// Codex reports one cumulative usage per `exec` turn; `input_tokens` already includes the cached part.
const codexTokens = (lines: string[]): Tokens => {
  const tokens: Tokens = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  for (const event of lines.map(parseLine)) {
    const usage = event?.type === 'turn.completed' ? event.usage : undefined;
    if (usage) {
      tokens.inputTokens += (usage.input_tokens ?? 0) - (usage.cached_input_tokens ?? 0);
      tokens.cacheReadTokens += usage.cached_input_tokens ?? 0;
      tokens.outputTokens += usage.output_tokens ?? 0;
    }
  }
  return tokens;
};

/**
 * Count the tokens of one agent run and price them.
 *
 * Claude's own cost line wins when the run finished; otherwise the tokens are priced from the price
 * table agent-eval also uses, and a model missing there gives `usd: null`.
 */
export const usageFromStream = (
  streamFile: string,
  engine: Engine,
  model: string,
  prices: PriceTable = MODEL_PRICING
): RunResultFile['usage'] => {
  const lines = readFileSync(streamFile, 'utf8').split('\n');
  const claudeTotals = engine === 'claude' ? claudeResultTotals(lines) : undefined;
  if (claudeTotals) {
    const { usd, ...tokens } = claudeTotals;
    return { ...tokens, usd, model, priceSource: 'agent' };
  }
  const tokens = engine === 'claude' ? claudeTokens(lines) : codexTokens(lines);
  const price = prices[model];
  if (!price) {
    return { ...tokens, usd: null, model, priceSource: 'table' };
  }
  // The same rule as agent-eval: a cache write costs 1.25x input (Anthropic's 5-minute TTL rate),
  // and a cache read 0.1x input when the table has no rate of its own.
  const usd =
    (tokens.inputTokens * price.input +
      tokens.outputTokens * price.output +
      tokens.cacheReadTokens * (price.cacheRead ?? price.input * 0.1) +
      tokens.cacheWriteTokens * price.input * 1.25) /
    1_000_000;
  return { ...tokens, usd, model, priceSource: 'table' };
};
