import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupMsw } from '../../../utils/test-helpers/msw.ts';
import {
  commentsHandler,
  mvcIssue,
  mvcPr,
  reviewsHandler,
  teamMembersHandler,
} from '../test-helpers/fixtures.ts';
import { checkRealProblem } from './check.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: vi.fn() }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

const PR_COORDS = { owner: 'storybookjs', repo: 'storybook', number: 1 };
const ISSUE_COORDS = { owner: 'storybookjs', repo: 'storybook', number: 100 };

/**
 * Baseline handlers for the endpoints checkRealProblem hits on every
 * LLM-path call: PR comments, PR reviews, linked-issue comments (default
 * mvcIssue is #100), and the three maintainer teams. Tests that care about
 * specific content override with `server.use`.
 */
function baselineHandlers() {
  return [
    commentsHandler(PR_COORDS, []),
    reviewsHandler(PR_COORDS, []),
    commentsHandler(ISSUE_COORDS, []),
    teamMembersHandler({ org: 'storybookjs', slug: 'core' }, []),
    teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, []),
    teamMembersHandler({ org: 'storybookjs', slug: 'maintainers' }, []),
  ];
}

describe('checkRealProblem', () => {
  const { server } = setupMsw();
  beforeEach(() => {
    mockJudge.mockReset();
    server.use(...baselineHandlers());
  });

  it('FAIL when no linked issues (no LLM call)', async () => {
    const r = await checkRealProblem(mvcPr());
    expect(r.status).toBe('fail');
    expect(r.evidence).toMatch(/no linked issue/i);
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('FAIL when only linked issue is closed (no LLM call)', async () => {
    const r = await checkRealProblem(mvcPr({ linkedIssues: [mvcIssue({ state: 'closed' })] }));
    expect(r.status).toBe('fail');
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('PASS when LLM judges substantive match', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'bug',
      reasoning: 'fixes core path',
    });
    const r = await checkRealProblem(mvcPr({ linkedIssues: [mvcIssue()] }));
    expect(r.status).toBe('pass');
    expect(r.evidence).toContain('bug');
  });

  it('FAIL when LLM judges no match', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: false,
      category: 'bug',
      reasoning: 'tangential',
    });
    const r = await checkRealProblem(mvcPr({ linkedIssues: [mvcIssue()] }));
    expect(r.status).toBe('fail');
  });

  it('FAIL when feature does not fit any accepted category', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'feature',
      reasoning: 'matches',
      featureFit: 'none',
    });
    const r = await checkRealProblem(mvcPr({ linkedIssues: [mvcIssue()] }));
    expect(r.status).toBe('fail');
    expect(r.evidence).toMatch(/maintainer approval/i);
  });

  it('PASS when feature fits one of accepted categories', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'feature',
      reasoning: 'matches',
      featureFit: 'augments-api',
    });
    const r = await checkRealProblem(mvcPr({ linkedIssues: [mvcIssue()] }));
    expect(r.status).toBe('pass');
  });

  it('WARN when match but linked-issue refs are broken', async () => {
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'bug',
      reasoning: 'ok',
    });
    const r = await checkRealProblem(
      mvcPr({ linkedIssues: [mvcIssue()], unresolved: ['storybookjs/storybook#999'] })
    );
    expect(r.status).toBe('warn');
    expect(r.evidence).toContain('#999');
  });

  it('surfaces PR comments and reviews with [maintainer] markers in the prompt', async () => {
    server.use(
      commentsHandler(PR_COORDS, [
        { login: 'shilman' }, // maintainer
        { login: 'random-contributor' },
      ]),
      reviewsHandler(PR_COORDS, [
        { login: 'kasperpeulen', state: 'APPROVED', body: 'LGTM' },
        { login: 'random-contributor', state: 'COMMENTED', body: 'question' },
      ]),
      teamMembersHandler({ org: 'storybookjs', slug: 'core' }, ['shilman']),
      teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, ['kasperpeulen'])
    );
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'bug',
      reasoning: 'ok',
    });
    await checkRealProblem(mvcPr({ linkedIssues: [mvcIssue()] }));
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('[maintainer] shilman');
    expect(prompt).toContain('[maintainer] kasperpeulen');
    expect(prompt).toContain('random-contributor');
    // Non-maintainer commenters aren't marked.
    expect(prompt).not.toContain('[maintainer] random-contributor');
    expect(prompt).toContain('[APPROVED]');
  });

  it('surfaces issue comments with maintainer flags', async () => {
    const issue = mvcIssue({ number: 200, author: 'opener' });
    server.use(
      commentsHandler({ owner: issue.owner, repo: issue.repo, number: issue.number }, [
        { login: 'shilman' },
        { login: 'opener' }, // the issue OP replies
      ]),
      teamMembersHandler({ org: 'storybookjs', slug: 'core' }, ['shilman'])
    );
    mockJudge.mockResolvedValueOnce({
      matchesIssue: true,
      category: 'bug',
      reasoning: 'ok',
    });
    await checkRealProblem(mvcPr({ linkedIssues: [issue] }));
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('[maintainer] shilman');
    expect(prompt).toContain('opener');
    expect(prompt).not.toContain('[maintainer] opener');
    expect(prompt).toContain('Issue storybookjs/storybook#200');
  });
});
