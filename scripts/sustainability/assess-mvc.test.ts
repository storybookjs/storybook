import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupMsw } from '../utils/test-helpers/msw.ts';
import { crossRefsHandler, mvcIssue, mvcPr } from './assess-mvc/test-helpers/fixtures.ts';
import { runAssessment } from './assess-mvc.ts';

const { mockJudge, mockJudgeText } = vi.hoisted(() => ({
  mockJudge: vi.fn(),
  mockJudgeText: vi.fn(),
}));

vi.mock('../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: mockJudgeText }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

const basePr = mvcPr({ linkedIssues: [mvcIssue({ number: 42 })] });

// Unified shape satisfies every check's schema (zod's default `.strip()`
// silently drops unknown keys) so we don't need to enumerate per-call shapes.
const allPassJudge = {
  matchesIssue: true,
  category: 'bug',
  reasoning: 'ok',
  featureFit: 'augments-api',
  verdict: 'pass',
};

describe('runAssessment (Phase 2: deterministic + LLM)', () => {
  const { server } = setupMsw();
  beforeEach(() => {
    mockJudge.mockReset();
    mockJudgeText.mockReset();
    // checkDuplicate hits cross-refs for each linked issue. Default to empty
    // responses; individual tests override when they care.
    server.use(crossRefsHandler());
  });

  it('FAILs and early-aborts when human check fails; only synthesis runs', async () => {
    mockJudgeText.mockResolvedValueOnce('composed');
    const result = await runAssessment(mvcPr({ labels: ['agent-scan:automated'] }));
    expect(result.verdict).toBe('fail');
    expect(result.earlyAbort).toBe(true);
    // No LLM judgments on early-abort; only synthesis (judgeText) runs.
    expect(mockJudge).not.toHaveBeenCalled();
    expect(mockJudgeText).toHaveBeenCalledOnce();
    expect(result.labelsToAdd).toContain('mvc:failed');
  });

  it('PASSes when deterministic checks pass; runs 4 LLM checks + synthesis', async () => {
    mockJudge.mockResolvedValue(allPassJudge);
    mockJudgeText.mockResolvedValueOnce('composed review body');
    const result = await runAssessment(basePr);
    expect(result.verdict).toBe('pass');
    expect(result.earlyAbort).toBe(false);
    // cost-benefit short-circuits to PASS for a 0-LOC diff so its judge call
    // is skipped → at least the other 3 judge calls run.
    expect(mockJudge.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockJudgeText).toHaveBeenCalledOnce();
    expect(result.labelsToAdd).toContain('mvc:success');
    expect(result.reviewBody).toContain('composed review body');
  });
});
