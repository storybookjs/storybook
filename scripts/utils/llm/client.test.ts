import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { query } from '@anthropic-ai/claude-agent-sdk';

import { createLlmClient } from './client.ts';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

interface FakeAssistantMessage {
  type: 'assistant';
  message: { content: Array<{ type: string; text?: string }> };
}
interface FakeResultMessage {
  type: 'result';
}
type FakeMessage = FakeAssistantMessage | FakeResultMessage;

function fakeStream(messages: FakeMessage[]): AsyncGenerator<FakeMessage> {
  return (async function* () {
    for (const m of messages) yield m;
  })();
}

describe('LlmClient.judge', () => {
  it('parses structured JSON from assistant messages', async () => {
    vi.mocked(query).mockReturnValueOnce(
      fakeStream([
        {
          type: 'assistant',
          message: { content: [{ type: 'text', text: '{"verdict":"pass"}' }] },
        },
        { type: 'result' },
      ]) as unknown as ReturnType<typeof query>
    );
    const client = createLlmClient({ model: 'sonnet-4.6', effort: 'medium', verbose: false });
    const result = await client.judge('analyze', z.object({ verdict: z.enum(['pass', 'fail']) }));
    expect(result).toEqual({ verdict: 'pass' });
  });

  it('strips ```json fences', async () => {
    vi.mocked(query).mockReturnValueOnce(
      fakeStream([
        {
          type: 'assistant',
          message: {
            content: [{ type: 'text', text: '```json\n{"verdict":"fail"}\n```' }],
          },
        },
        { type: 'result' },
      ]) as unknown as ReturnType<typeof query>
    );
    const client = createLlmClient({ model: 'sonnet-4.6', effort: 'medium', verbose: false });
    const result = await client.judge('x', z.object({ verdict: z.enum(['pass', 'fail']) }));
    expect(result).toEqual({ verdict: 'fail' });
  });

  it('throws on invalid JSON', async () => {
    vi.mocked(query).mockReturnValueOnce(
      fakeStream([
        { type: 'assistant', message: { content: [{ type: 'text', text: 'not json at all' }] } },
        { type: 'result' },
      ]) as unknown as ReturnType<typeof query>
    );
    const client = createLlmClient({ model: 'sonnet-4.6', effort: 'medium', verbose: false });
    await expect(client.judge('x', z.object({ a: z.string() }))).rejects.toThrow(/JSON/);
  });

  it('throws on schema mismatch', async () => {
    vi.mocked(query).mockReturnValueOnce(
      fakeStream([
        { type: 'assistant', message: { content: [{ type: 'text', text: '{"unexpected":1}' }] } },
        { type: 'result' },
      ]) as unknown as ReturnType<typeof query>
    );
    const client = createLlmClient({ model: 'sonnet-4.6', effort: 'medium', verbose: false });
    await expect(client.judge('x', z.object({ verdict: z.enum(['pass', 'fail']) }))).rejects.toThrow();
  });
});
