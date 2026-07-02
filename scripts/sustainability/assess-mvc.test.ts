import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupMsw } from '../utils/test-helpers/msw.ts';
import {
  commentsHandler,
  crossRefsHandler,
  mvcIssue,
  mvcPr,
  reviewsHandler,
  teamMembersHandler,
} from './assess-mvc/test-helpers/fixtures.ts';
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
  status: 'pass',
  guidance: '',
  maintainerGuidance: '',
};

describe('runAssessment (Phase 2: deterministic + LLM)', () => {
  const { server } = setupMsw();
  beforeEach(() => {
    mockJudge.mockReset();
    mockJudgeText.mockReset();
    // checkDuplicate hits cross-refs; cost-benefit + real-problem hit PR
    // comments, PR reviews, linked-issue comments, and the maintainer
    // teams. Default to empty responses; individual tests override when
    // they care.
    server.use(
      crossRefsHandler(),
      commentsHandler({ owner: 'storybookjs', repo: 'storybook', number: 1 }),
      commentsHandler({ owner: 'storybookjs', repo: 'storybook', number: 42 }),
      reviewsHandler({ owner: 'storybookjs', repo: 'storybook', number: 1 }),
      teamMembersHandler({ org: 'storybookjs', slug: 'core' }, []),
      teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, []),
      teamMembersHandler({ org: 'storybookjs', slug: 'maintainers' }, [])
    );
  });

  it('FAILs and early-aborts when human check fails; no LLM calls made', async () => {
    const result = await runAssessment(mvcPr({ labels: ['agent-scan:automated'] }));
    expect(result.verdict).toBe('fail');
    expect(result.earlyAbort).toBe(true);
    // Neither the per-check judges nor synthesis call an LLM on early-abort;
    // synthesis is now mechanical template composition.
    expect(mockJudge).not.toHaveBeenCalled();
    expect(mockJudgeText).not.toHaveBeenCalled();
    expect(result.labelsToAdd).toContain('mvc:failed');
  });

  it('PASSes when deterministic checks pass; runs the LLM checks then composes review deterministically', async () => {
    mockJudge.mockResolvedValue(allPassJudge);
    const result = await runAssessment(basePr);
    expect(result.verdict).toBe('pass');
    expect(result.earlyAbort).toBe(false);
    // LLM-judged checks (real-problem, cost-benefit, explains-test,
    // provides-context) call `judge`. Synthesis is mechanical — no
    // `judgeText` call.
    expect(mockJudge.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockJudgeText).not.toHaveBeenCalled();
    expect(result.labelsToAdd).toContain('mvc:success');
    // The mechanical synthesizer emits the canned PASS intro verbatim.
    expect(result.reviewBody).toContain('Thanks for the contribution');
  });
});
