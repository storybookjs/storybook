import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

export interface TimelineEvent {
  type: 'closed' | 'reopened' | string;
  at: string;
}

interface IssueCoords {
  owner: string;
  repo: string;
  number: number;
}

async function fetchIssueTimelineImpl(issue: IssueCoords): Promise<TimelineEvent[]> {
  const client = getGithubClient();
  const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}/timeline', {
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number,
    per_page: 100,
  });
  return data.map((e) => ({ type: e.event, at: e.created_at }));
}

/**
 * Fetch the lifecycle timeline of a GitHub issue (closed/reopened/etc).
 * Memoized like {@link fetchCrossRefs}: issue identity is the key.
 */
export const fetchIssueTimeline = memoize(1000)(fetchIssueTimelineImpl);

/**
 * True iff this issue was closed at least once and subsequently reopened.
 * Useful for the duplicate-PR check: a previously merged fix that didn't
 * hold (issue reopened) means the duplicate-of-merged rule should not apply
 * to a fresh attempt.
 */
export async function wasClosedThenReopened(issue: IssueCoords): Promise<boolean> {
  const events = await fetchIssueTimeline(issue);
  let sawClosed = false;
  for (const event of events) {
    if (event.type === 'closed') sawClosed = true;
    if (event.type === 'reopened' && sawClosed) return true;
  }
  return false;
}
