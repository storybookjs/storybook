import { getGithubClient } from './client.ts';
import type { GithubRefCoords } from './pr.ts';

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
export async function submitReview(pr: GithubRefCoords, input: ReviewSubmission): Promise<void> {
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
export async function dismissPriorReviews(pr: GithubRefCoords, marker: string): Promise<void> {
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
    if (typeof review.body !== 'string' || !review.body.includes(marker)) continue;
    if (review.state === 'DISMISSED') continue;
    await client.rest(
      'PUT /repos/{owner}/{repo}/pulls/{pull_number}/reviews/{review_id}/dismissals',
      {
        owner: pr.owner,
        repo: pr.repo,
        pull_number: pr.number,
        review_id: review.id,
        message: 'Superseded by a newer MVC assessment.',
      }
    );
  }
}
