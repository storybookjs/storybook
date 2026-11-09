import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { usageFromStream } from './usage.ts';

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
    });
  });

  it('counts each Claude call once, using the last copy of its usage, when no result line exists', () => {
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
    // A result line without per-model totals (an aborted run) must not be trusted.

    const usage = usageFromStream(file, 'claude', 'claude-sonnet-5-5');

    expect(usage).toMatchObject({
      inputTokens: 15,
      outputTokens: 70,
      cacheReadTokens: 1000,
      cacheWriteTokens: 1000,
    });
    expect(usage.usd).toBeCloseTo(0.00343, 8);
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

    expect(usageFromStream(file, 'codex', 'gpt-5.4')).toMatchObject({
      inputTokens: 700,
      cacheReadTokens: 800,
      outputTokens: 150,
    });
  });

  it('reports no dollar figure for a model missing from pricing.json', () => {
    const file = streamFile([assistant('msg_1', { input_tokens: 1, output_tokens: 1 })]);

    expect(usageFromStream(file, 'claude', 'claude-unknown').usd).toBeNull();
  });
});
