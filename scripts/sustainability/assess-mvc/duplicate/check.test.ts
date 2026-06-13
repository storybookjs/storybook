import { describe, expect, it } from 'vitest';

import { setupMsw } from '../../../utils/test-helpers/msw.ts';
import { crossRefsHandler, mvcIssue } from '../test-helpers/fixtures.ts';
import { checkDuplicate } from './check.ts';

const ISSUE = mvcIssue({ number: 100 });

describe('checkDuplicate', () => {
  const { server } = setupMsw();

  it('PASS when no linked issues', async () => {
    const r = await checkDuplicate({ number: 1, linkedIssues: [] });
    expect(r.status).toBe('pass');
  });

  it('PASS when no other PRs reference any linked issue', async () => {
    server.use(crossRefsHandler());
    const r = await checkDuplicate({ number: 123, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('FAIL when any linked issue is already closed', async () => {
    const r = await checkDuplicate({
      number: 200,
      linkedIssues: [mvcIssue({ number: 100, state: 'closed' })],
    });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#100');
    expect(r.evidence).toMatch(/closed|resolved/i);
  });

  it('FAIL when an OLDER open PR (lower number) references the same issue', async () => {
    server.use(crossRefsHandler([{ prNumber: 100, prState: 'open', merged: false }]));
    const r = await checkDuplicate({ number: 200, linkedIssues: [ISSUE] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#100');
    expect(r.evidence).toContain('predates');
  });

  it('PASS when a NEWER open PR references the same issue (first-PR-wins)', async () => {
    server.use(crossRefsHandler([{ prNumber: 600, prState: 'open', merged: false }]));
    const r = await checkDuplicate({ number: 200, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('PASS when only merged PRs reference the issue', async () => {
    server.use(crossRefsHandler([{ prNumber: 789, prState: 'closed', merged: true }]));
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('PASS when only closed-unmerged PRs reference the issue', async () => {
    server.use(crossRefsHandler([{ prNumber: 555, prState: 'closed', merged: false }]));
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('excludes the PR-under-review from candidates', async () => {
    server.use(crossRefsHandler([{ prNumber: 123, prState: 'open', merged: false }]));
    const r = await checkDuplicate({ number: 123, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });
});
