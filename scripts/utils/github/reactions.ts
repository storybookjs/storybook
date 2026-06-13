import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

export interface Reactions {
  plus1: number;
  minus1: number;
  tada: number;
}

interface IssueCoords {
  owner: string;
  repo: string;
  number: number;
}

async function fetchIssueReactionsImpl(issue: IssueCoords): Promise<Reactions> {
  const client = getGithubClient();
  const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}', {
    owner: issue.owner,
    repo: issue.repo,
    issue_number: issue.number,
  });
  const r = data.reactions ?? { '+1': 0, '-1': 0, hooray: 0 };
  return { plus1: r['+1'] ?? 0, minus1: r['-1'] ?? 0, tada: r.hooray ?? 0 };
}

/**
 * Fetch the +1/-1/tada reaction counts for an issue. Used as a "community
 * weight" signal — an issue with many +1s is more worth maintainer time than
 * one with none, all else being equal. Memoized by issue identity.
 */
export const fetchIssueReactions = memoize(1000)(fetchIssueReactionsImpl);
