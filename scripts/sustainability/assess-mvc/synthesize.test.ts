import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKER } from './config.ts';
import { synthesizeReview } from './synthesize.ts';

const { mockJudge, mockJudgeText } = vi.hoisted(() => ({
  mockJudge: vi.fn(),
  mockJudgeText: vi.fn(),
}));

vi.mock('../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: mockJudgeText }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

describe('synthesizeReview', () => {
  beforeEach(() => {
    mockJudge.mockReset();
    mockJudgeText.mockReset();
  });

  it('prefixes the body with the HTML marker', async () => {
    mockJudgeText.mockResolvedValueOnce('composed body');
    const body = await synthesizeReview({
      results: [{ id: 'human', status: 'pass', evidence: 'ok' }],
      earlyAbort: false,
    });
    expect(body).toContain(MARKER);
    expect(body).toContain('composed body');
  });

  it('uses judgeText (text mode), not judge (JSON mode)', async () => {
    mockJudgeText.mockResolvedValueOnce('body');
    await synthesizeReview({
      results: [{ id: 'human', status: 'pass', evidence: 'ok' }],
      earlyAbort: false,
    });
    expect(mockJudgeText).toHaveBeenCalledOnce();
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('tells the LLM which checks were not performed on early-abort', async () => {
    mockJudgeText.mockResolvedValueOnce('composed');
    await synthesizeReview({
      results: [
        { id: 'human', status: 'pass', evidence: 'ok' },
        { id: 'duplicate', status: 'fail', evidence: 'dupe of #1' },
        { id: 'real-problem', status: 'deferred', evidence: 'skipped' },
        { id: 'cost-benefit', status: 'deferred', evidence: 'skipped' },
      ],
      earlyAbort: true,
    });
    const prompt = mockJudgeText.mock.calls[0][0] as string;
    expect(prompt).toContain('NOT performed');
    expect(prompt).toContain('real-problem');
    expect(prompt).toContain('cost-benefit');
  });
});
