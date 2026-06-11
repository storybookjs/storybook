import { describe, expect, it } from 'vitest';

import { setupMsw } from '../../../utils/test-helpers/msw.ts';
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

interface CrossRef {
  number: number;
  state: 'OPEN' | 'CLOSED';
  merged: boolean;
}

interface TimelineEvent {
  event: string;
  created_at: string;
}

const TIMELINE_URL =
  'https://api.github.com/repos/storybookjs/storybook/issues/100/timeline';

const handlers = ({
  crossRefs,
  timeline,
}: {
  crossRefs?: CrossRef[];
  timeline?: TimelineEvent[];
} = {}) => [
  {
    method: 'post' as const,
    url: 'https://api.github.com/graphql',
    json: {
      data: {
        repository: {
          issue: {
            timelineItems: {
              nodes: (crossRefs ?? []).map((src) => ({ source: src })),
            },
          },
        },
      },
    },
  },
  { method: 'get' as const, url: TIMELINE_URL, json: timeline ?? [] },
];

describe('checkDuplicate', () => {
  const { server, http, HttpResponse } = setupMsw();

  const register = ({ crossRefs, timeline }: { crossRefs?: CrossRef[]; timeline?: TimelineEvent[] } = {}) => {
    server.use(
      ...handlers({ crossRefs, timeline }).map((h) =>
        h.method === 'post'
          ? http.post(h.url, () => HttpResponse.json(h.json))
          : http.get(h.url, () => HttpResponse.json(h.json))
      )
    );
  };

  it('PASS when no linked issues', async () => {
    const r = await checkDuplicate({ number: 1, linkedIssues: [] });
    expect(r.status).toBe('pass');
  });

  it('PASS when no other PRs reference any linked issue', async () => {
    register({ crossRefs: [] });
    const r = await checkDuplicate({ number: 123, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('FAIL when an OLDER open PR (lower number) references the same issue', async () => {
    register({ crossRefs: [{ number: 100, state: 'OPEN', merged: false }] });
    const r = await checkDuplicate({ number: 200, linkedIssues: [ISSUE] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#100');
    expect(r.evidence).toContain('predates');
  });

  it('PASS when a NEWER open PR references the same issue (first-PR-wins)', async () => {
    register({ crossRefs: [{ number: 600, state: 'OPEN', merged: false }] });
    const r = await checkDuplicate({ number: 200, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('FAIL when another merged PR references the issue and issue was never reopened', async () => {
    register({
      crossRefs: [{ number: 789, state: 'CLOSED', merged: true }],
      timeline: [],
    });
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('fail');
    expect(r.evidence).toContain('#789');
  });

  it('PASS when prior merged PR exists and the issue was closed-then-reopened', async () => {
    register({
      crossRefs: [{ number: 789, state: 'CLOSED', merged: true }],
      timeline: [
        { event: 'closed', created_at: '2025-01-01' },
        { event: 'reopened', created_at: '2025-02-01' },
      ],
    });
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('PASS (silent) when only closed-unmerged PRs reference the issue', async () => {
    register({ crossRefs: [{ number: 555, state: 'CLOSED', merged: false }] });
    const r = await checkDuplicate({ number: 1000, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });

  it('excludes the PR-under-review from candidates', async () => {
    register({ crossRefs: [{ number: 123, state: 'OPEN', merged: false }] });
    const r = await checkDuplicate({ number: 123, linkedIssues: [ISSUE] });
    expect(r.status).toBe('pass');
  });
});
