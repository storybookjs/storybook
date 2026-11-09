import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { usageFromStream } from './usage.ts';

const PRICES = {
  'claude-test': { input: 2, output: 10, cacheRead: 0.2 },
  'codex-test': { input: 2, output: 10, cacheRead: 0.1 },
};

const streamFile = (events: unknown[]) => {
  const file = join(mkdtempSync(join(tmpdir(), 'qa-usage-')), 'agent-stream.jsonl');
  writeFileSync(file, [...events.map((event) => JSON.stringify(event)), 'not json'].join('\n'));
  return file;
};

const assistant = (id: string, usage: Record<string, number>) => ({
  type: 'assistant',
  message: { id, usage },
});

describe('usageFromStream', () => {
  it("takes Claude's own totals and cost from the result line when the run finished", () => {
    const file = streamFile([
      assistant('msg_1', { input_tokens: 10, output_tokens: 50 }),
      {
        type: 'result',
        model_usage_since_last_result: {
          'claude-sonnet-5-5': {
            inputTokens: 98,
            outputTokens: 17438,
            cacheReadInputTokens: 2294960,
            cacheCreationInputTokens: 61711,
            costUSD: 0.5583495,
          },
        },
      },
    ]);

    expect(usageFromStream(file, 'claude', 'claude-sonnet-5-5')).toEqual({
      inputTokens: 98,
      outputTokens: 17438,
      cacheReadTokens: 2294960,
      cacheWriteTokens: 61711,
      usd: 0.5583495,
      model: 'claude-sonnet-5-5',
      priceSource: 'agent',
    });
  });

  it('counts each Claude call once, using the last copy of its usage, when no result line has per-model totals', () => {
    const file = streamFile([
      assistant('msg_1', {
        input_tokens: 10,
        output_tokens: 1,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 1000,
      }),
      assistant('msg_1', {
        input_tokens: 10,
        output_tokens: 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 1000,
      }),
      assistant('msg_2', {
        input_tokens: 5,
        output_tokens: 20,
        cache_read_input_tokens: 1000,
        cache_creation_input_tokens: 0,
      }),
      { type: 'result', usage: { input_tokens: 999999, output_tokens: 999999 } },
    ]);

    const usage = usageFromStream(file, 'claude', 'claude-test', PRICES);

    expect(usage).toMatchObject({
      inputTokens: 15,
      outputTokens: 70,
      cacheReadTokens: 1000,
      cacheWriteTokens: 1000,
      priceSource: 'table',
    });
    expect(usage.usd).toBeCloseTo((15 * 2 + 70 * 10 + 1000 * 0.2 + 1000 * 2 * 1.25) / 1_000_000, 8);
  });

  it('sums every Codex turn and splits cached input out of the input total', () => {
    const file = streamFile([
      {
        type: 'turn.completed',
        usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 100 },
      },
      {
        type: 'turn.completed',
        usage: { input_tokens: 500, cached_input_tokens: 0, output_tokens: 50 },
      },
    ]);

    expect(usageFromStream(file, 'codex', 'codex-test', PRICES)).toEqual({
      inputTokens: 700,
      cacheReadTokens: 800,
      cacheWriteTokens: 0,
      outputTokens: 150,
      usd: (700 * 2 + 150 * 10 + 800 * 0.1) / 1_000_000,
      model: 'codex-test',
      priceSource: 'table',
    });
  });

  it('reports no dollar figure for a model missing from the price table', () => {
    const file = streamFile([assistant('msg_1', { input_tokens: 1, output_tokens: 1 })]);

    expect(usageFromStream(file, 'claude', 'claude-unknown', PRICES)).toMatchObject({
      usd: null,
      priceSource: 'table',
    });
  });
});
