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

const PR_COORDS = { owner: 'storybookjs', repo: 'storybook', number: 1 };

/**
 * Every LLM-path test needs handlers for the PR's own issue-comments and
 * the three maintainer teams (comments + team lists are fetched
 * unconditionally). Tests that link issues also need one comments handler
 * per linked issue. This helper covers the always-required baseline; call
 * `server.use(...)` afterwards to override specific endpoints.
 */
function baselineHandlers() {
  return [
    commentsHandler(PR_COORDS, []),
    teamMembersHandler({ org: 'storybookjs', slug: 'core' }, []),
    teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, []),
    teamMembersHandler({ org: 'storybookjs', slug: 'maintainers' }, []),
  ];
}

describe('checkCostBenefit', () => {
  const { server } = setupMsw();
  beforeEach(() => {
    mockJudge.mockReset();
    server.use(...baselineHandlers());
  });

  it('relays LLM PASS for larger changes without a linked issue', async () => {
    mockJudge.mockResolvedValueOnce({ status: 'pass', reasoning: 'proportionate' });
    const r = await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('pass');
  });

  it('relays LLM WARN', async () => {
    mockJudge.mockResolvedValueOnce({ status: 'warn', reasoning: 'concerns' });
    const r = await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    expect(r.status).toBe('warn');
  });

  it('relays LLM FAIL with guidance', async () => {
    mockJudge.mockResolvedValueOnce({
      status: 'fail',
      reasoning: 'edge-case + huge diff',
      guidance: 'split the PR',
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
    server.use(commentsHandler(issue, []));
    mockJudge.mockResolvedValueOnce({ status: 'pass', reasoning: 'ok' });
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

  it('excludes the issue-thread author, maintainers, and bots from that issue', async () => {
    const issue = mvcIssue({ number: 77, author: 'opener' });
    server.use(
      commentsHandler(issue, [
        { login: 'opener' }, // filtered: issue author on its own thread
        { login: 'shilman' }, // filtered: maintainer
        { login: 'kasperpeulen' }, // filtered: maintainer
        { login: 'renovate[bot]', type: 'Bot' }, // filtered: bot via type
        { login: 'ci-runner[bot]' }, // filtered: bot via [bot] suffix
        { login: 'random-user-1' },
        { login: 'random-user-2' },
        { login: 'random-user-2' }, // dedup
        { login: null }, // dropped: deleted account
      ]),
      teamMembersHandler({ org: 'storybookjs', slug: 'core' }, ['shilman']),
      teamMembersHandler({ org: 'storybookjs', slug: 'developer-experience' }, ['kasperpeulen'])
    );
    mockJudge.mockResolvedValueOnce({ status: 'pass', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({
        files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }],
        linkedIssues: [issue],
      })
    );
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toMatch(/External participants[^:]*: 2\./);
  });

  it('filters each item author only on that item — cross-thread comments still count', async () => {
    // Bob authored #1 and comments on #2 → counts as a participant.
    // 'someone' is the PR author and comments on #1 → counts (issue author is only filtered locally).
    // Alice authored #2 and comments on the PR → counts.
    const issue1 = mvcIssue({ number: 10, author: 'bob' });
    const issue2 = mvcIssue({ number: 20, author: 'alice' });
    server.use(
      commentsHandler(PR_COORDS, [
        { login: 'someone' }, // filtered: PR author on the PR
        { login: 'alice' }, // counted: not the PR author
      ]),
      commentsHandler(issue1, [
        { login: 'bob' }, // filtered: issue1 author on issue1
        { login: 'someone' }, // counted: PR author outside their own thread
      ]),
      commentsHandler(issue2, [
        { login: 'alice' }, // filtered: issue2 author on issue2
        { login: 'bob' }, // counted: #1's author on #2
      ])
    );
    mockJudge.mockResolvedValueOnce({ status: 'pass', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({
        files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }],
        linkedIssues: [issue1, issue2],
      })
    );
    const prompt = mockJudge.mock.calls[0][0] as string;
    // Union {alice, someone, bob} = 3 distinct external participants.
    expect(prompt).toMatch(/External participants[^:]*: 3\./);
  });

  it('counts PR-only participants when no issue is linked', async () => {
    server.use(commentsHandler(PR_COORDS, [{ login: 'alice' }, { login: 'bob' }]));
    mockJudge.mockResolvedValueOnce({ status: 'pass', reasoning: 'ok' });
    await checkCostBenefit(
      mvcPr({ files: [{ path: 'a.ts', additions: 200, deletions: 0, status: 'modified' }] })
    );
    const prompt = mockJudge.mock.calls[0][0] as string;
    expect(prompt).toMatch(/External participants[^:]*: 2\./);
  });

  it('uses pr labels for severity when no linked issue is present', async () => {
    mockJudge.mockResolvedValueOnce({ status: 'warn', reasoning: 'ok' });
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
