import { describe, expect, it, vi } from 'vitest';

import { checkDuplicate } from './duplicate.ts';

const ISSUE = {
  owner: 'storybookjs',
  repo: 'storybook',
  number: 100,
  url: 'u',
  title: 'I',
  body: '',
  state: 'open' as const,
  labels: [],
};

interface FakeClientConfig {
  crossRefs?: Array<{ number: number; state: 'OPEN' | 'CLOSED'; merged: boolean }>;
  timeline?: Array<{ event: string; created_at: string }>;
}

const buildClient = (config: FakeClientConfig = {}) =>
  ({
    graphql: vi.fn().mockResolvedValue({
      repository: {
        issue: {
          timelineItems: {
            nodes: (config.crossRefs ?? []).map((src) => ({ source: src })),
          },
        },
      },
    }),
    rest: vi.fn(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline') {
        return { data: config.timeline ?? [] };
      }
      throw new Error(`unexpected ${route}`);
    }),
  }) as any;

describe('checkDuplicate', () => {
  it('PASS when no linked issues at all', async () => {
    const r = await checkDuplicate({ number: 1, linkedIssues: [] }, { client: buildClient() });
    expect(r.status).toBe('pass');
  });

  it('PASS when no other PRs reference any linked issue', async () => {
    const r = await checkDuplicate(
      { number: 123, linkedIssues: [ISSUE] },
      { client: buildClient({ crossRefs: [] }) }
    );
    expect(r.status).toBe('pass');
  });

  it('FAIL when another open PR references the same issue', async () => {
    const r = await checkDuplicate(
      { number: 123, linkedIssues: [ISSUE] },
      {
        client: buildClient({
          crossRefs: [{ number: 456, state: 'OPEN', merged: false }],
        }),
      }
    );
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#456');
  });

  it('FAIL when another merged PR references the issue and issue was never reopened', async () => {
    const r = await checkDuplicate(
      { number: 123, linkedIssues: [ISSUE] },
      {
        client: buildClient({
          crossRefs: [{ number: 789, state: 'CLOSED', merged: true }],
          timeline: [],
        }),
      }
    );
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#789');
  });

  it('PASS when prior merged PR exists and the issue was closed-then-reopened', async () => {
    const r = await checkDuplicate(
      { number: 123, linkedIssues: [ISSUE] },
      {
        client: buildClient({
          crossRefs: [{ number: 789, state: 'CLOSED', merged: true }],
          timeline: [
            { event: 'closed', created_at: '2025-01-01' },
            { event: 'reopened', created_at: '2025-02-01' },
          ],
        }),
      }
    );
    expect(r.status).toBe('pass');
  });

  it('PASS (silent) when only closed-unmerged PRs reference the issue', async () => {
    const r = await checkDuplicate(
      { number: 123, linkedIssues: [ISSUE] },
      {
        client: buildClient({
          crossRefs: [{ number: 555, state: 'CLOSED', merged: false }],
        }),
      }
    );
    expect(r.status).toBe('pass');
  });

  it('excludes the PR-under-review from candidates', async () => {
    const r = await checkDuplicate(
      { number: 123, linkedIssues: [ISSUE] },
      {
        client: buildClient({
          crossRefs: [{ number: 123, state: 'OPEN', merged: false }],
        }),
      }
    );
    expect(r.status).toBe('pass');
  });
});
