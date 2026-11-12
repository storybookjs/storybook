import { readFileSync } from 'node:fs';

import { fs as memfs, vol } from 'memfs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usageFromStream } from './usage.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

const PRICES = {
  'claude-test': { input: 2, output: 10, cacheRead: 0.2 },
  'codex-test': { input: 2, output: 10, cacheRead: 0.1 },
};

const streamFile = (events: unknown[]) => {
  const file = '/run/agent-stream.jsonl';
  vol.fromJSON({
    [file]: [...events.map((event) => JSON.stringify(event)), 'not json'].join('\n'),
  });
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

  it('adds up every result line of a run whose answer was sent back to the agent', () => {
    const since = (outputTokens: number, costUSD: number) => ({
      type: 'result',
      model_usage_since_last_result: {
        'claude-haiku-5-5': {
          inputTokens: 1,
          outputTokens,
          cacheReadInputTokens: 100,
          cacheCreationInputTokens: 10,
          costUSD,
        },
      },
    });
    const file = streamFile([since(85771, 1.25), since(4475, 0.5)]);

    expect(usageFromStream(file, 'claude', 'claude-haiku-5-5')).toEqual({
      inputTokens: 2,
      outputTokens: 90246,
      cacheReadTokens: 200,
      cacheWriteTokens: 20,
      usd: 1.75,
      model: 'claude-haiku-5-5',
      priceSource: 'agent',
    });
  });

  it('falls back to the per-call sum when one of several result lines lacks per-model totals', () => {
    const file = streamFile([
      assistant('msg_1', {
        input_tokens: 10,
        output_tokens: 50,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      }),
      { type: 'result', usage: { input_tokens: 999999, output_tokens: 999999 } },
      {
        type: 'result',
        model_usage_since_last_result: {
          'claude-test': {
            inputTokens: 1,
            outputTokens: 2,
            cacheReadInputTokens: 0,
            cacheCreationInputTokens: 0,
            costUSD: 9,
          },
        },
      },
    ]);

    expect(usageFromStream(file, 'claude', 'claude-test', PRICES)).toMatchObject({
      inputTokens: 10,
      outputTokens: 50,
      priceSource: 'table',
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
