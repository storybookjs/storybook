import { readFileSync } from 'node:fs';

import type { Engine, RunResultFile } from './types.ts';

interface Tokens {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

const PRICING_FILE = new URL('../pricing.json', import.meta.url);

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

// Claude Code repeats a call's usage on every stream line split from that call, and the last copy is final.
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

export const usageFromStream = (
  streamFile: string,
  engine: Engine,
  model: string
): RunResultFile['usage'] => {
  const lines = readFileSync(streamFile, 'utf8').split('\n');
  const tokens = engine === 'claude' ? claudeTokens(lines) : codexTokens(lines);
  const pricing: Record<string, Price> = JSON.parse(readFileSync(PRICING_FILE, 'utf8'));
  const price = pricing[model];
  const usd = price
    ? (tokens.inputTokens * price.input +
        tokens.outputTokens * price.output +
        tokens.cacheReadTokens * price.cacheRead +
        tokens.cacheWriteTokens * price.cacheWrite) /
      1_000_000
    : null;
  return { ...tokens, usd, model };
};
