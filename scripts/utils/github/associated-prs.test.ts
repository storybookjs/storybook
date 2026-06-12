import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import {
  getAssociatedPrs,
  pickLatestMergedPr,
  type AssociatedPr,
} from './associated-prs.ts';

describe('getAssociatedPrs', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('throws when commit is missing', async () => {
    await expect(getAssociatedPrs({ repo: 'storybookjs/storybook', commit: '' })).rejects.toThrow(
      /commit/
    );
  });

  it('throws on malformed repo', async () => {
    await expect(
      getAssociatedPrs({ repo: 'invalid-repo', commit: 'abc123' })
    ).rejects.toThrow(/owner\/name/);
  });

  it('returns the commit URL, commit author, and associated PRs', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({
          data: {
            repository: {
              object: {
                commitUrl: 'https://github.com/storybookjs/storybook/commit/abc123',
                author: { user: { login: 'someone', url: 'https://github.com/someone' } },
                associatedPullRequests: {
                  nodes: [
                    {
                      id: 'PR_kw1',
                      number: 42,
                      title: 'Fix x',
                      state: 'MERGED',
                      url: 'u',
                      mergedAt: '2025-01-15T10:00:00Z',
                      labels: { nodes: [{ name: 'bug' }, { name: 'patch:yes' }] },
                      author: { login: 'someone', url: 'https://github.com/someone' },
                    },
                  ],
                },
              },
            },
          },
        })
      )
    );
    const ctx = await getAssociatedPrs({ repo: 'storybookjs/storybook', commit: 'abc123' });
    expect(ctx.commitUrl).toBe('https://github.com/storybookjs/storybook/commit/abc123');
    expect(ctx.commitAuthor).toEqual({ login: 'someone', url: 'https://github.com/someone' });
    expect(ctx.associatedPrs).toHaveLength(1);
    expect(ctx.associatedPrs[0]).toMatchObject({
      number: 42,
      title: 'Fix x',
      state: 'MERGED',
      labels: ['bug', 'patch:yes'],
    });
  });

  it('returns empty context when the commit is not found', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({ data: { repository: { object: null } } })
      )
    );
    const ctx = await getAssociatedPrs({
      repo: 'storybookjs/storybook',
      commit: 'deadbeef',
    });
    expect(ctx).toEqual({ commitUrl: null, commitAuthor: null, associatedPrs: [] });
  });
});

describe('pickLatestMergedPr', () => {
  const pr = (overrides: Partial<AssociatedPr>): AssociatedPr => ({
    id: 'x',
    number: 1,
    title: 't',
    state: 'MERGED',
    url: 'u',
    mergedAt: null,
    author: null,
    labels: [],
    ...overrides,
  });

  it('returns null for an empty list', () => {
    expect(pickLatestMergedPr([])).toBeNull();
  });

  it('picks the PR with the latest mergedAt', () => {
    const result = pickLatestMergedPr([
      pr({ number: 1, mergedAt: '2025-01-01T00:00:00Z' }),
      pr({ number: 2, mergedAt: '2025-03-01T00:00:00Z' }),
      pr({ number: 3, mergedAt: '2025-02-01T00:00:00Z' }),
    ]);
    expect(result?.number).toBe(2);
  });

  it('sorts unmerged PRs to the end', () => {
    const result = pickLatestMergedPr([
      pr({ number: 1, mergedAt: null }),
      pr({ number: 2, mergedAt: '2025-01-01T00:00:00Z' }),
    ]);
    expect(result?.number).toBe(2);
  });

  it('returns the only unmerged PR when no PR has been merged', () => {
    const result = pickLatestMergedPr([pr({ number: 1, mergedAt: null })]);
    expect(result?.number).toBe(1);
  });
});
