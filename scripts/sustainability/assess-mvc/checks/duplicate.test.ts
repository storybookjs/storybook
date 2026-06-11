import { describe, expect, it } from 'vitest';

import { checkDuplicate, type CrossRefEvent, type TimelineEvent } from './duplicate.ts';

const issue = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 100,
  state: 'open' as const,
  url: 'u',
};

const make = (crossRefs: CrossRefEvent[], timeline: TimelineEvent[] = []) =>
  async () => ({ crossRefs, timeline });

describe('checkDuplicate', () => {
  it('PASS when no other PRs reference any linked issue', async () => {
    const r = await checkDuplicate(123, [issue], make([]));
    expect(r.status).toBe('pass');
  });

  it('FAIL when another open PR references the same issue', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 456, prState: 'open', merged: false }])
    );
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#456');
  });

  it('FAIL when another merged PR references the issue and issue was never reopened', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 789, prState: 'closed', merged: true }], [])
    );
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#789');
  });

  it('PASS when prior merged PR exists and the issue was closed-then-reopened', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make(
        [{ prNumber: 789, prState: 'closed', merged: true }],
        [
          { type: 'closed', at: '2025-01-01' },
          { type: 'reopened', at: '2025-02-01' },
        ]
      )
    );
    expect(r.status).toBe('pass');
  });

  it('PASS (silent) when only closed-unmerged PRs reference the issue', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 555, prState: 'closed', merged: false }])
    );
    expect(r.status).toBe('pass');
  });

  it('excludes the PR-under-review from candidates', async () => {
    const r = await checkDuplicate(
      123,
      [issue],
      make([{ prNumber: 123, prState: 'open', merged: false }])
    );
    expect(r.status).toBe('pass');
  });
});
