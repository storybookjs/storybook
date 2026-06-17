import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { dismissPriorReviews, submitReview } from './reviews.ts';

const target = { owner: 'storybookjs' as const, repo: 'storybook' as const, number: 1 };
const MARKER = '<!-- mvc-check:v1 -->';

describe('submitReview', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('POSTs the review with the requested event and body', async () => {
    let received: unknown = null;
    server.use(
      http.post(
        'https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews',
        async ({ request }) => {
          received = await request.json();
          return HttpResponse.json({});
        }
      )
    );
    await submitReview(target, { event: 'REQUEST_CHANGES', body: `${MARKER}\nReview body` });
    expect(received).toMatchObject({
      event: 'REQUEST_CHANGES',
      body: expect.stringContaining(MARKER),
    });
  });
});

describe('dismissPriorReviews', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('dismisses only reviews whose body contains the marker and are not already dismissed', async () => {
    const dismissed: number[] = [];
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews', () =>
        HttpResponse.json([
          { id: 1, body: 'human comment, no marker', state: 'COMMENTED' },
          { id: 2, body: `${MARKER}\nprevious review`, state: 'CHANGES_REQUESTED' },
          { id: 3, body: `${MARKER}\nolder review`, state: 'DISMISSED' },
          { id: 4, body: 'unrelated', state: 'APPROVED' },
        ])
      ),
      http.put(
        'https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews/:id/dismissals',
        ({ params }) => {
          dismissed.push(Number(params.id));
          return HttpResponse.json({});
        }
      )
    );
    await dismissPriorReviews(target, MARKER);
    expect(dismissed).toEqual([2]);
  });

  it('does nothing when there are no prior bot reviews', async () => {
    const dismissed: number[] = [];
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews', () =>
        HttpResponse.json([{ id: 9, body: 'no marker', state: 'COMMENTED' }])
      ),
      http.put(
        'https://api.github.com/repos/storybookjs/storybook/pulls/1/reviews/:id/dismissals',
        ({ params }) => {
          dismissed.push(Number(params.id));
          return HttpResponse.json({});
        }
      )
    );
    await dismissPriorReviews(target, MARKER);
    expect(dismissed).toEqual([]);
  });
});
