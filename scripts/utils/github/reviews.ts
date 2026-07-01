import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import type { IssueOrPrId } from './types.ts';

export type ReviewEvent = 'APPROVE' | 'COMMENT' | 'REQUEST_CHANGES';

export interface ReviewSubmission {
  event: ReviewEvent;
  body: string;
}

/**
 * Submit a PR review. The body is sent verbatim — callers are responsible for
 * prepending any identifying marker so future runs can recognize their own
 * reviews via `dismissPriorReviews`.
 */
export async function submitReview(pr: IssueOrPrId, input: ReviewSubmission): Promise<void> {
  const client = getGithubClient();
  await client.rest('POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
    owner: pr.owner,
    repo: pr.repo,
    pull_number: pr.number,
    event: input.event,
    body: input.body,
  });
}

/**
 * Dismiss every prior review on the PR whose body contains `marker`. Used by
 * `--dismiss-previous` so each run's review starts on a clean slate without
 * accumulating stale verdicts.
 *
 * We only dismiss reviews that aren't already dismissed (avoids wasted API
 * calls and noisy timelines). The marker check is a substring match because
 * the marker is an HTML comment we control; we never put it anywhere else.
 */
export async function dismissPriorReviews(pr: IssueOrPrId, marker: string): Promise<void> {
  const client = getGithubClient();
  const { data: reviews } = await client.rest(
    'GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews',
    {
      owner: pr.owner,
      repo: pr.repo,
      pull_number: pr.number,
      per_page: 100,
    }
  );
  for (const review of reviews) {
    if (typeof review.body !== 'string' || !review.body.includes(marker)) {
      continue;
    }
    if (review.state === 'DISMISSED') {
      continue;
    }
    await client.rest(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
      {
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number,
        review_id: review.id,
        message: 'Superseded by a newer Minimum Viable Contribution assessment.',
      }
    );
  }
}

/**
 * Non-`PENDING` states from GitHub's PR-review endpoint. `PENDING` reviews
 * are drafts only visible to their author, so they never appear in the
 * REST response we consume and we intentionally omit them from the type.
 */
export type PrReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED';

export interface PrReview {
  authorLogin: string | null;
  submittedAt: string | null;
  state: PrReviewState;
  body: string;
  isBot: boolean;
}

function looksLikeBotLogin(login: string | null): boolean {
  return typeof login === 'string' && login.endsWith('[bot]');
}

async function getPrReviewsImpl(coords: IssueOrPrId): Promise<PrReview[]> {
  const client = getGithubClient();
  const reviews: PrReview[] = [];
  let page = 1;
  while (true) {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/pulls/{pull_number}/reviews', {
      owner: coords.owner,
      repo: coords.repo,
      pull_number: coords.number,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const r of data) {
      const login = r.user?.login ?? null;
      reviews.push({
        authorLogin: login,
        submittedAt: r.submitted_at ?? null,
        state: r.state as PrReviewState,
        body: r.body ?? '',
        isBot: r.user?.type === 'Bot' || looksLikeBotLogin(login),
      });
    }
    if (data.length < 100) break;
    page += 1;
  }
  return reviews;
}

/**
 * Fetch every submitted review on a pull request. `PENDING` (draft) reviews
 * aren't returned by GitHub in this endpoint. Paginated, memoized by
 * coords identity.
 */
export const getPrReviews = memoize(1000)(getPrReviewsImpl);
