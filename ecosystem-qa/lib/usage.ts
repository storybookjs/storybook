import { readFileSync } from 'node:fs';

import { z } from 'zod';

import { MODEL_PRICING } from '../../agent-eval/lib/usage.ts';
import type { Engine, RunResultFile } from './schema.ts';

interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

const count = z
  .number()
  .nullish()
  .transform((value) => value ?? 0);

const ResultLine = z.object({ type: z.literal('result') });

const ClaudeResult = ResultLine.extend({
  model_usage_since_last_result: z.record(
    z.string(),
    z.object({
      inputTokens: count,
      outputTokens: count,
      cacheReadInputTokens: count,
      cacheCreationInputTokens: count,
      costUSD: count,
    })
  ),
});

const ClaudeAssistant = z.object({
  type: z.literal('assistant'),
  message: z.object({
    id: z.string(),
    usage: z.object({
      input_tokens: count,
      output_tokens: count,
      cache_read_input_tokens: count,
      cache_creation_input_tokens: count,
    }),
  }),
});

const CodexTurn = z.object({
  type: z.literal('turn.completed'),
  usage: z.object({ input_tokens: count, cached_input_tokens: count, output_tokens: count }),
});

const parseLine = (line: string): unknown => {
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
const claudeResultTotals = (events: unknown[]): ClaudeTotals | undefined => {
  const result = ClaudeResult.safeParse(
    events.findLast((event) => ResultLine.safeParse(event).success)
  );
  if (!result.success) {
    return undefined;
  }
  const totals: ClaudeTotals = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    usd: 0,
  };
  for (const usage of Object.values(result.data.model_usage_since_last_result)) {
    totals.inputTokens += usage.inputTokens;
    totals.outputTokens += usage.outputTokens;
    totals.cacheReadTokens += usage.cacheReadInputTokens;
    totals.cacheWriteTokens += usage.cacheCreationInputTokens;
    totals.usd += usage.costUSD;
  }
  return totals;
};

// Fallback when the run ended without a `result` line: Claude Code repeats a call's usage on every
// stream line split from that call, and the last copy is final.
const claudeTokens = (events: unknown[]): Tokens => {
  const byMessage = new Map<string, z.infer<typeof ClaudeAssistant>['message']['usage']>();
  for (const event of events) {
    const parsed = ClaudeAssistant.safeParse(event);
    if (parsed.success) {
      byMessage.set(parsed.data.message.id, parsed.data.message.usage);
    }
  }
  const usages = [...byMessage.values()];
  const sum = (field: keyof (typeof usages)[number]) =>
    usages.reduce((total, usage) => total + usage[field], 0);
  return {
    inputTokens: sum('input_tokens'),
    outputTokens: sum('output_tokens'),
    cacheReadTokens: sum('cache_read_input_tokens'),
    cacheWriteTokens: sum('cache_creation_input_tokens'),
  };
};

// Codex reports one cumulative usage per `exec` turn; `input_tokens` already includes the cached part.
const codexTokens = (events: unknown[]): Tokens => {
  const tokens: Tokens = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
  for (const event of events) {
    const parsed = CodexTurn.safeParse(event);
    if (parsed.success) {
      const { input_tokens, cached_input_tokens, output_tokens } = parsed.data.usage;
      tokens.inputTokens += input_tokens - cached_input_tokens;
      tokens.cacheReadTokens += cached_input_tokens;
      tokens.outputTokens += output_tokens;
    }
  }
  return tokens;
};

// Count the tokens of one agent run and price them.
//
// Claude's own cost line wins when the run finished; otherwise the tokens are priced from the price
// table agent-eval also uses, and a model missing there gives `usd: null`.
export const usageFromStream = (
  streamFile: string,
  engine: Engine,
  model: string,
  prices: typeof MODEL_PRICING = MODEL_PRICING
): RunResultFile['usage'] => {
  const events = readFileSync(streamFile, 'utf8').split('\n').map(parseLine);
  const claudeTotals = engine === 'claude' ? claudeResultTotals(events) : undefined;
  if (claudeTotals) {
    const { usd, ...tokens } = claudeTotals;
    return { ...tokens, usd, model, priceSource: 'agent' };
  }
  const tokens = engine === 'claude' ? claudeTokens(events) : codexTokens(events);
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
