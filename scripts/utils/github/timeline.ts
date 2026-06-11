import memoize from 'memoizerific';

import type { GithubClient } from './client.ts';

export interface TimelineEvent {
  type: 'closed' | 'reopened' | string;
  at: string;
}

interface IssueCoords {
  owner: string;
  repo: string;
  number: number;
}

async function fetchIssueTimelineImpl(
  client: GithubClient,
  issue: IssueCoords
): Promise<TimelineEvent[]> {
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
 * Memoized like {@link fetchCrossRefs}: (client, issue) identity is the key.
 */
export const fetchIssueTimeline = memoize(1000)(fetchIssueTimelineImpl);
