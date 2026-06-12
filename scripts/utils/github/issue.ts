import { getGithubClient } from './client.ts';
import type { FetchedIssueOrPr, IssueOrPrId } from './types.ts';
import { isHttpError } from './utils.ts';

export interface Issue extends FetchedIssueOrPr {
  reactions: {
    total_count: number;
    '+1': number;
    '-1': number;
    laugh: number;
    confused: number;
    heart: number;
    hooray: number;
    eyes: number;
    rocket: number;
  };
}

/**
 * Fetch a number via REST `/issues/{n}` and classify it as issue vs PR. The
 * endpoint returns both kinds; PRs carry a `pull_request` sub-object. 404 /
 * 410 means the number is neither.
 */
async function fetchIssueImpl(coords: IssueOrPrId): Promise<Issue | null> {
  const client = getGithubClient();
  try {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}', {
      owner: coords.owner,
      repo: coords.repo,
      issue_number: coords.number,
    });

    if ((data as { pull_request?: unknown }).pull_request) {
      return null;
    }

    return {
      owner: coords.owner,
      repo: coords.repo,
      number: coords.number,
      url: data.html_url,
      title: data.title,
      state: data.state === 'open' ? 'open' : 'closed',
      body: data.body ?? '',
      author: data.user?.login ?? '',
      labels: data.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))),
      reactions: data.reactions ?? {
        total_count: 0,
        '+1': 0,
        '-1': 0,
        laugh: 0,
        confused: 0,
        heart: 0,
        hooray: 0,
        eyes: 0,
        rocket: 0,
      },
    };
  } catch (err: unknown) {
    if (isHttpError(err, 404) || isHttpError(err, 410)) {
      return null;
    }
    throw err;
  }
}

/**
 * Fetch a GitHub issue; returns undefined if the issue ref is a PR.
 *
 * Memoized by `issueId` identity.
 */
export const fetchIssue = memoizerific(1000)(fetchIssueImpl);
