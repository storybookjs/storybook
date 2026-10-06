import { afterEach, describe, expect, it, vi } from 'vitest';

const finalMessage = vi.fn();
const stream = vi.fn(() => ({ finalMessage }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { stream };
  },
}));

import { runJudge, type JudgeRequest } from './judge.ts';

const REQUEST = {
  model: 'claude-opus-4-8',
  max_tokens: 32_000,
  system: [],
  messages: [],
} as unknown as JudgeRequest;

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.ANTHROPIC_API_KEY;
});

describe('runJudge', () => {
  it('returns the parsed nodes from the structured response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    finalMessage.mockResolvedValue({
      stop_reason: 'end_turn',
      content: [
        {
          type: 'text',
          text: '{"nodes":[{"path":"App/A[0]","file":"a.tsx","line":1,"tag":"A","kind":"ds"}]}',
        },
      ],
      usage: { input_tokens: 100, cache_read_input_tokens: 200, output_tokens: 50 },
    });
    await expect(runJudge(REQUEST)).resolves.toEqual({
      judged: { nodes: [{ path: 'App/A[0]', file: 'a.tsx', line: 1, tag: 'A', kind: 'ds' }] },
      usage: { inputTokens: 100, cacheReadTokens: 200, cacheWriteTokens: 0, outputTokens: 50 },
    });
  });

  // A refusal returns HTTP 200 with no usable content. Reading content[0] blindly
  // would surface as a confusing parse error three frames away from the cause.
  it('names a refusal rather than failing to parse it', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    finalMessage.mockResolvedValue({ stop_reason: 'refusal', stop_details: null, content: [] });
    await expect(runJudge(REQUEST)).rejects.toThrow(/refused/i);
  });

  it('names a truncated response rather than parsing half of it', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    finalMessage.mockResolvedValue({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"nodes":[' }],
    });
    await expect(runJudge(REQUEST)).rejects.toThrow(/max_tokens/);
  });
});

describe('assertApiKey', () => {
  it('names the variable and where to set it', async () => {
    const { assertApiKey } = await import('./judge.ts');
    expect(() => assertApiKey()).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => assertApiKey()).toThrow(/\.env\.local/);
  });
});
