import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { getPrReviews } from './reviews.ts';

describe('getPrReviews', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('fetches a single page of reviews', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews', () =>
        HttpResponse.json([
          {
            id: 1,
            user: { login: 'alice', type: 'User' },
            state: 'APPROVED',
            body: 'LGTM',
            submitted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 2,
            user: { login: 'bob', type: 'User' },
            state: 'CHANGES_REQUESTED',
            body: 'needs test',
            submitted_at: '2024-01-02T00:00:00Z',
          },
        ])
      )
    );
    const reviews = await getPrReviews({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(reviews).toEqual([
      {
        authorLogin: 'alice',
        submittedAt: '2024-01-01T00:00:00Z',
        state: 'APPROVED',
        body: 'LGTM',
        isBot: false,
      },
      {
        authorLogin: 'bob',
        submittedAt: '2024-01-02T00:00:00Z',
        state: 'CHANGES_REQUESTED',
        body: 'needs test',
        isBot: false,
      },
    ]);
  });

  it('marks bot reviewers via user.type', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews', () =>
        HttpResponse.json([
          {
            id: 1,
            user: { login: 'codecov[bot]', type: 'Bot' },
            state: 'COMMENTED',
            body: 'coverage report',
            submitted_at: '2024-01-01T00:00:00Z',
          },
        ])
      )
    );
    const reviews = await getPrReviews({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(reviews[0].isBot).toBe(true);
  });

  it('paginates until a short page is returned', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      user: { login: `u${i + 1}`, type: 'User' },
      state: 'COMMENTED',
      body: '',
      submitted_at: '2024-01-01T00:00:00Z',
    }));
    const page2 = [
      {
        id: 101,
        user: { login: 'u101', type: 'User' },
        state: 'APPROVED',
        body: '',
        submitted_at: '2024-01-01T00:00:00Z',
      },
    ];
    server.use(
      http.get(
        'https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews',
        ({ request }) => {
          const page = new URL(request.url).searchParams.get('page');
          return HttpResponse.json(page === '2' ? page2 : page1);
        }
      )
    );
    const reviews = await getPrReviews({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(reviews).toHaveLength(101);
    expect(reviews[100].state).toBe('APPROVED');
  });

  it('handles missing user (deleted account)', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews', () =>
        HttpResponse.json([
          {
            id: 1,
            user: null,
            state: 'COMMENTED',
            body: '',
            submitted_at: '2024-01-01T00:00:00Z',
          },
        ])
      )
    );
    const reviews = await getPrReviews({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
    });
    expect(reviews[0].authorLogin).toBeNull();
    expect(reviews[0].isBot).toBe(false);
  });
});
