import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKER } from './config.ts';
import { synthesizeReview } from './synthesize.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

describe('synthesizeReview', () => {
  beforeEach(() => mockJudge.mockReset());

  it('prefixes the body with the HTML marker', async () => {
    mockJudge.mockResolvedValueOnce({ reviewBody: 'composed body' });
    const body = await synthesizeReview({
      results: [{ id: 'human', status: 'pass', evidence: 'ok' }],
      earlyAbort: false,
    });
    expect(body).toContain(MARKER);
    expect(body).toContain('composed body');
  });

  it('tells the LLM which checks were not performed on early-abort', async () => {
    mockJudge.mockResolvedValueOnce({ reviewBody: 'composed' });
    await synthesizeReview({
      results: [
        { id: 'human', status: 'pass', evidence: 'ok' },
        { id: 'duplicate', status: 'fail', evidence: 'dupe of #1' },
        { id: 'real-problem', status: 'deferred', evidence: 'skipped' },
        { id: 'cost-benefit', status: 'deferred', evidence: 'skipped' },
      ],
      earlyAbort: true,
    });
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('NOT performed');
    expect(prompt).toContain('real-problem');
    expect(prompt).toContain('cost-benefit');
  });
});
