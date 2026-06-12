import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { getLatestMergedPrsFromCommits } from './associated-prs.ts';

describe('getLatestMergedPrsFromCommits', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('returns [] for an empty commit list (no network call)', async () => {
    let called = false;
    server.use(
      http.post('https://api.github.com/graphql', () => {
        called = true;
        return HttpResponse.json({});
      })
    );
    const result = await getLatestMergedPrsFromCommits({
      repo: 'storybookjs/storybook',
      commits: [],
    });
    expect(result).toEqual([]);
    expect(called).toBe(false);
  });

  it('throws on malformed repo', async () => {
    await expect(
      getLatestMergedPrsFromCommits({ repo: 'invalid-repo', commits: ['abc'] })
    ).rejects.toThrow(/owner\/name/);
  });

  it('throws when any commit SHA is empty', async () => {
    await expect(
      getLatestMergedPrsFromCommits({ repo: 'storybookjs/storybook', commits: ['abc', ''] })
    ).rejects.toThrow(/non-empty/);
  });

  it('batches multiple commits into a single GraphQL query and maps results in order', async () => {
    let queries = 0;
    let receivedQuery = '';
    server.use(
      http.post('https://api.github.com/graphql', async ({ request }) => {
        queries += 1;
        const body = (await request.json()) as { query: string };
        receivedQuery = body.query;
        return HttpResponse.json({
          data: {
            repository: {
              c0: {
                commitUrl: 'https://github.com/o/r/commit/aaa',
                author: { user: { login: 'alice', url: 'https://github.com/alice' } },
                associatedPullRequests: {
                  nodes: [
                    {
                      id: 'PR_1',
                      number: 1,
                      title: 'First',
                      state: 'MERGED',
                      url: 'u1',
                      mergedAt: '2025-01-01T00:00:00Z',
                      labels: { nodes: [{ name: 'bug' }] },
                      author: { login: 'alice', url: 'https://github.com/alice' },
                    },
                  ],
                },
              },
              c1: null,
              c2: {
                commitUrl: 'https://github.com/o/r/commit/ccc',
                associatedPullRequests: {
                  nodes: [
                    {
                      id: 'PR_2',
                      number: 2,
                      title: 'Older',
                      state: 'MERGED',
                      url: 'u2',
                      mergedAt: '2025-01-01T00:00:00Z',
                      labels: { nodes: [] },
                      author: null,
                    },
                    {
                      id: 'PR_3',
                      number: 3,
                      title: 'Newer',
                      state: 'MERGED',
                      url: 'u3',
                      mergedAt: '2025-03-01T00:00:00Z',
                      labels: { nodes: [{ name: 'patch:yes' }] },
                      author: { login: 'bob', url: 'https://github.com/bob' },
                    },
                  ],
                },
              },
            },
          },
        });
      })
    );

    const result = await getLatestMergedPrsFromCommits({
      repo: 'storybookjs/storybook',
      commits: ['aaa', 'bbb', 'ccc'],
    });

    expect(queries).toBe(1);
    // Three aliased subfields in the query.
    expect(receivedQuery).toContain('c0:');
    expect(receivedQuery).toContain('c1:');
    expect(receivedQuery).toContain('c2:');

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      commit: 'aaa',
      pr: expect.objectContaining({ number: 1, labels: ['bug'] }),
    });
    expect(result[1]).toEqual({ commit: 'bbb', commitUrl: null, commitAuthor: null, pr: null });
    // For multiple associated PRs, the latest-merged one wins.
    expect(result[2].pr).toMatchObject({ number: 3, title: 'Newer' });
  });
});
