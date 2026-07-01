import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { getIssueOrPrComments, getUniqueParticipants } from './comments.ts';

describe('getIssueOrPrComments', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('fetches a single page of comments', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/1/comments', () =>
        HttpResponse.json([
          {
            id: 1,
            user: { login: 'alice', type: 'User' },
            created_at: '2024-01-01T00:00:00Z',
            body: 'a',
          },
          {
            id: 2,
            user: { login: 'bob', type: 'User' },
            created_at: '2024-01-02T00:00:00Z',
            body: 'b',
          },
        ])
      )
    );
    const comments = await getIssueOrPrComments({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(comments).toEqual([
      { authorLogin: 'alice', createdAt: '2024-01-01T00:00:00Z', body: 'a', isBot: false },
      { authorLogin: 'bob', createdAt: '2024-01-02T00:00:00Z', body: 'b', isBot: false },
    ]);
  });

  it('marks GitHub App comments as bots via user.type', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/1/comments', () =>
        HttpResponse.json([
          {
            id: 1,
            user: { login: 'renovate[bot]', type: 'Bot' },
            created_at: '2024-01-01T00:00:00Z',
            body: '',
          },
        ])
      )
    );
    const comments = await getIssueOrPrComments({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(comments[0].isBot).toBe(true);
  });

  it('marks [bot]-suffixed logins as bots even when user.type is missing', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/1/comments', () =>
        HttpResponse.json([
          {
            id: 1,
            user: { login: 'suspicious[bot]' },
            created_at: '2024-01-01T00:00:00Z',
            body: '',
          },
        ])
      )
    );
    const comments = await getIssueOrPrComments({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(comments[0].isBot).toBe(true);
  });

  it('paginates until a short page is returned', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      user: { login: `u${i + 1}`, type: 'User' },
      created_at: '2024-01-01T00:00:00Z',
      body: '',
    }));
    const page2 = [
      {
        id: 101,
        user: { login: 'u101', type: 'User' },
        created_at: '2024-01-01T00:00:00Z',
        body: '',
      },
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
    expect(comments[0].isBot).toBe(false);
  });
});

describe('getUniqueParticipants', () => {
  const c = (login: string | null, isBot = false) => ({
    authorLogin: login,
    createdAt: '',
    body: '',
    isBot,
  });

  it('returns the set of distinct authors', () => {
    const set = getUniqueParticipants([c('a'), c('b'), c('a')]);
    expect([...set].sort()).toEqual(['a', 'b']);
  });

  it('drops null and empty-string logins', () => {
    const set = getUniqueParticipants([c(null), c(''), c('   '), c('a')]);
    expect([...set]).toEqual(['a']);
  });

  it('drops bots', () => {
    const set = getUniqueParticipants([
      c('renovate[bot]', true),
      c('github-actions[bot]', true),
      c('human'),
    ]);
    expect([...set]).toEqual(['human']);
  });

  it('drops logins in the ignore iterable', () => {
    const set = getUniqueParticipants([c('alice'), c('bob'), c('carol')], ['bob', 'carol']);
    expect([...set]).toEqual(['alice']);
  });

  it('accepts nulls/undefineds in the ignore iterable without adding them', () => {
    const set = getUniqueParticipants([c('alice'), c(''), c(null)], [null, undefined, 'alice']);
    expect([...set]).toEqual([]);
  });

  it('accepts a Set as the ignore iterable', () => {
    const set = getUniqueParticipants([c('alice'), c('bob')], new Set(['alice']));
    expect([...set]).toEqual(['bob']);
  });
});
