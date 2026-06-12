import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { getIssueOrPrComments, getUniqueParticipants } from './comments.ts';

describe('getIssueOrPrComments', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('fetches a single page of comments', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/1/comments', () =>
        HttpResponse.json([
          { id: 1, user: { login: 'alice' }, created_at: '2024-01-01T00:00:00Z', body: 'a' },
          { id: 2, user: { login: 'bob' }, created_at: '2024-01-02T00:00:00Z', body: 'b' },
        ])
      )
    );
    const comments = await getIssueOrPrComments({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(comments).toEqual([
      { authorLogin: 'alice', createdAt: '2024-01-01T00:00:00Z', body: 'a' },
      { authorLogin: 'bob', createdAt: '2024-01-02T00:00:00Z', body: 'b' },
    ]);
  });

  it('paginates until a short page is returned', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      user: { login: `u${i + 1}` },
      created_at: '2024-01-01T00:00:00Z',
      body: '',
    }));
    const page2 = [
      { id: 101, user: { login: 'u101' }, created_at: '2024-01-01T00:00:00Z', body: '' },
    ];
    server.use(
      http.get(
        'https://api.github.com/repos/storybookjs/storybook/issues/1/comments',
        ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          return HttpResponse.json(page === '2' ? page2 : page1);
        }
      )
    );
    const comments = await getIssueOrPrComments({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(comments).toHaveLength(101);
    expect(comments[100].authorLogin).toBe('u101');
  });

  it('treats missing user as null login (deleted account)', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/1/comments', () =>
        HttpResponse.json([{ id: 1, user: null, created_at: '2024-01-01T00:00:00Z', body: '' }])
      )
    );
    const comments = await getIssueOrPrComments({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(comments[0].authorLogin).toBeNull();
  });
});

describe('getUniqueParticipants', () => {
  it('returns the set of distinct authors', () => {
    const set = getUniqueParticipants([
      { authorLogin: 'a', createdAt: '', body: '' },
      { authorLogin: 'b', createdAt: '', body: '' },
      { authorLogin: 'a', createdAt: '', body: '' },
    ]);
    expect([...set].sort()).toEqual(['a', 'b']);
  });

  it('drops null and empty-string logins', () => {
    const set = getUniqueParticipants([
      { authorLogin: null, createdAt: '', body: '' },
      { authorLogin: '', createdAt: '', body: '' },
      { authorLogin: '   ', createdAt: '', body: '' },
      { authorLogin: 'a', createdAt: '', body: '' },
    ]);
    expect([...set]).toEqual(['a']);
  });
});
