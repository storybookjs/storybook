import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MARKER, REVIEW_FOOTER } from './config.ts';
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

  it('prefixes the body with the HTML marker and appends the deterministic footer', async () => {
    mockJudgeText.mockResolvedValueOnce('composed body');
    const body = await synthesizeReview({
      results: [{ id: 'human', status: 'pass', reasoning: 'ok' }],
      earlyAbort: false,
    });
    expect(body).toContain(MARKER);
    expect(body).toContain('composed body');
    expect(body).toContain(REVIEW_FOOTER);
    expect(body).toMatch(/discord\.gg\/invite\/storybook/);
    expect(body).toMatch(/#contributing/);
    expect(body.endsWith(REVIEW_FOOTER)).toBe(true);
  });

  it('uses judgeText (text mode), not judge (JSON mode)', async () => {
    mockJudgeText.mockResolvedValueOnce('body');
    await synthesizeReview({
      results: [{ id: 'human', status: 'pass', reasoning: 'ok' }],
      earlyAbort: false,
    });
    expect(mockJudgeText).toHaveBeenCalledOnce();
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('tells the LLM which checks were not performed on early-abort', async () => {
    mockJudgeText.mockResolvedValueOnce('composed');
    await synthesizeReview({
      results: [
        { id: 'human', status: 'pass', reasoning: 'ok' },
        { id: 'duplicate', status: 'fail', reasoning: 'dupe of #1' },
        { id: 'real-problem', status: 'deferred', reasoning: 'skipped' },
        { id: 'cost-benefit', status: 'deferred', reasoning: 'skipped' },
      ],
      earlyAbort: true,
    });
    const prompt = mockJudgeText.mock.calls[0][0] as string;
    expect(prompt).toContain('NOT performed');
    expect(prompt).toContain('real-problem');
    expect(prompt).toContain('cost-benefit');
  });
});
