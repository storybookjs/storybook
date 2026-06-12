import { describe, expect, it } from 'vitest';

import { setupMsw } from '../../../utils/test-helpers/msw.ts';
import {
  crossRefsHandler,
  mvcIssue,
  timelineHandler,
} from '../test-helpers/fixtures.ts';
import { checkDuplicate } from './check.ts';

const ISSUE = mvcIssue({ number: 100 });

describe('checkDuplicate', () => {
  const { server } = setupMsw();

  it('PASS when no linked issues', async () => {
    const r = await checkDuplicate({ number: 1, linkedIssues: [] });
    expect(r.status).toBe('pass');
  });

  it('PASS when no other PRs reference any linked issue', async () => {
    server.use(crossRefsHandler(), timelineHandler(100));
    const r = await checkDuplicate({ number: 123, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('FAIL when an OLDER open PR (lower number) references the same issue', async () => {
    server.use(
      crossRefsHandler([{ prNumber: 100, prState: 'open', merged: false }]),
      timelineHandler(100)
    );
    const r = await checkDuplicate({ number: 200, linkedIssues: [ISSUE] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#100');
    expect(r.evidence).toContain('predates');
  });

  it('PASS when a NEWER open PR references the same issue (first-PR-wins)', async () => {
    server.use(
      crossRefsHandler([{ prNumber: 600, prState: 'open', merged: false }]),
      timelineHandler(100)
    );
    const r = await checkDuplicate({ number: 200, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('FAIL when another merged PR references the issue and issue was never reopened', async () => {
    server.use(
      crossRefsHandler([{ prNumber: 789, prState: 'closed', merged: true }]),
      timelineHandler(100)
    );
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#789');
  });

  it('PASS when prior merged PR exists and the issue was closed-then-reopened', async () => {
    server.use(
      crossRefsHandler([{ prNumber: 789, prState: 'closed', merged: true }]),
      timelineHandler(100, [
        { type: 'closed', at: '2025-01-01' },
        { type: 'reopened', at: '2025-02-01' },
      ])
    );
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('PASS (silent) when only closed-unmerged PRs reference the issue', async () => {
    server.use(
      crossRefsHandler([{ prNumber: 555, prState: 'closed', merged: false }]),
      timelineHandler(100)
    );
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('excludes the PR-under-review from candidates', async () => {
    server.use(
      crossRefsHandler([{ prNumber: 123, prState: 'open', merged: false }]),
      timelineHandler(100)
    );
    const r = await checkDuplicate({ number: 123, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });
});
