import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setupMsw } from '../../../utils/test-helpers/msw.ts';
import { commentsHandler, mvcIssue, mvcPr, teamMembersHandler } from '../test-helpers/fixtures.ts';
import { checkCostBenefit } from './check.ts';

const { mockJudge } = vi.hoisted(() => ({ mockJudge: vi.fn() }));

vi.mock('../../../utils/llm/client', () => ({
  getLlmClient: () => ({ judge: mockJudge, judgeText: vi.fn() }),
  configureLlmClient: vi.fn(),
  resetLlmClient: vi.fn(),
}));

describe('checkCostBenefit', () => {
  const { server } = setupMsw();
  beforeEach(() => mockJudge.mockReset());

  /**
   * Most LLM-path tests link an open issue so the check can fetch its
   * comments + maintainers. These default handlers serve empty bodies; tests
   * that care about specific counts override them with `server.use`.
   */
  function defaultPopularityHandlers(issue: { owner: string; repo: string; number: number }) {
    return [
      commentsHandler(issue, []),
      teamMembersHandler({ org: 'storybookjs', slug: 'core' }, []),
      teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, []),
      teamMembersHandler({ org: 'storybookjs', slug: 'maintainers' }, []),
    ];
  }

  it('PASS for trivial diff regardless of LLM (no LLM call)', async () => {
    const r = await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 5, deletions: 1, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
    expect(mockJudge).not.toHaveBeenCalled();
  });

  it('relays LLM PASS for larger changes without a linked issue', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'proportionate' });
    const r = await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
  });

  it('relays LLM WARN', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'warn', reasoning: 'concerns' });
    const r = await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('warn');
  });

  it('relays LLM FAIL with guidance', async () => {
    mockJudge.mockResolvedValueOnce({
      verdict: 'fail',
      reasoning: 'edge-case + huge diff',
    });
    const r = await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 800, deletions: 100, status: 'modified' }] })
    );
    expect(r.status).toBe('fail');
    expect(r.guidance).toBeTruthy();
  });

  it('includes severity and reactions for the first open linked issue', async () => {
    const issue = mvcIssue({
      number: 42,
      labels: ['sev:S2'],
      author: 'opener',
      reactions: {
        total_count: 8,
        '+1': 5,
        '-1': 1,
        laugh: 0,
        confused: 0,
        heart: 0,
        hooray: 2,
        eyes: 0,
        rocket: 0,
      },
    });
    server.use(...defaultPopularityHandlers(issue));
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({
        files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }],
        linkedIssues: [issue],
      })
    );
    expect(mockJudge).toHaveBeenCalledOnce();
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('sev:S2');
    expect(prompt).toContain('+5');
  });

  it('counts external commenters (excluding author + maintainers) as participants', async () => {
    const issue = mvcIssue({ number: 77, author: 'opener' });
    server.use(
      commentsHandler(issue, [
        { login: 'opener' }, // filtered: issue author
        { login: 'opener' }, // filtered (dupe)
        { login: 'shilman' }, // filtered: maintainer
        { login: 'kasperpeulen' }, // filtered: maintainer
        { login: 'random-user-1' },
        { login: 'random-user-2' },
        { login: 'random-user-2' }, // dedup → 1
        { login: null }, // dropped: deleted account
      ]),
      teamMembersHandler({ org: 'storybookjs', slug: 'core' }, ['shilman']),
      teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, ['kasperpeulen']),
      teamMembersHandler({ org: 'storybookjs', slug: 'maintainers' }, [])
    );
    mockJudge.mockResolvedValueOnce({ verdict: 'pass', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({
        files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }],
        linkedIssues: [issue],
      })
    );
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toMatch(/External participants on the linked issue.*: 2\./);
  });

  it('reports "no linked issue" in the participants line when none is open', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'warn', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('External participants on the linked issue: (no linked issue).');
  });

  it('uses pr labels for severity when no linked issue is present', async () => {
    mockJudge.mockResolvedValueOnce({ verdict: 'warn', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({
        labels: ['sev:S1'],
        files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }],
      })
    );
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toContain('sev:S1');
  });
});
