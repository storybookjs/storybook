import { describe, expect, test } from 'vitest';

import { collectTranscriptUsage } from './usage.ts';

const MILLION = 1_000_000;

const claudeTranscript = JSON.stringify({
  type: 'assistant',
  message: {
    id: 'msg_1',
    usage: {
      input_tokens: MILLION,
      cache_creation_input_tokens: MILLION,
      cache_read_input_tokens: MILLION,
      output_tokens: MILLION,
    },
  },
});

const codexTranscript = JSON.stringify({
  type: 'turn.completed',
  usage: { input_tokens: 2 * MILLION, cached_input_tokens: MILLION, output_tokens: MILLION },
});

describe('collectTranscriptUsage', () => {
  test('prices Claude cache reads at the model-specific rate when one is set', () => {
    const usage = collectTranscriptUsage(claudeTranscript, 'claude-opus-5-5');

    expect(usage?.estimatedCostUsd).toBeCloseTo(4 + 4 * 1.25 + 0.2 + 20);
  });

  test('prices Claude cache reads at 0.1x input when the model sets no rate', () => {
    const usage = collectTranscriptUsage(claudeTranscript, 'claude-opus-4-8');

    expect(usage?.estimatedCostUsd).toBeCloseTo(5 + 5 * 1.25 + 0.5 + 25);
  });

  test('prices a Codex transcript from uncached input, cached input and output', () => {
    const usage = collectTranscriptUsage(codexTranscript, 'gpt-6-sol');

    expect(usage?.estimatedCostUsd).toBeCloseTo(2 + 0.2 + 10);
  });

  test('leaves the estimate undefined for an unknown model', () => {
    const usage = collectTranscriptUsage(claudeTranscript, 'unknown-model');

    expect(usage).toMatchObject({ totalTokens: 4 * MILLION, estimatedCostUsd: undefined });
  });
});
