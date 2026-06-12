import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

export interface IssueOrPrComment {
  authorLogin: string | null;
  createdAt: string;
  body: string;
}

interface IssueCoords {
  owner: string;
  repo: string;
  number: number;
}

async function getIssueOrPrCommentsImpl(coords: IssueCoords): Promise<IssueOrPrComment[]> {
  const client = getGithubClient();
  const comments: IssueOrPrComment[] = [];
  let page = 1;
  while (true) {
    const { data } = await client.rest('GET /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner: coords.owner,
      repo: coords.repo,
      issue_number: coords.number,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const c of data) {
      comments.push({
        authorLogin: c.user?.login ?? null,
        createdAt: c.created_at,
        body: c.body ?? '',
      });
    }
    if (data.length < 100) break;
    page += 1;
  }
  return comments;
}

/**
 * Fetch all comments on a GitHub issue or PR (the REST `/issues/{n}/comments`
 * endpoint covers both — PRs share the issue ID space). Paginated. Memoized
 * by coords identity.
 */
export const getIssueOrPrComments = memoize(1000)(getIssueOrPrCommentsImpl);

/**
 * Extract the set of unique authors from a comment list. Drops null /
 * empty-string logins defensively (shouldn't happen for real users, but
 * GitHub sometimes returns `null` for deleted-account comments).
 */
export function getUniqueParticipants(comments: readonly IssueOrPrComment[]): Set<string> {
  const set = new Set<string>();
  for (const c of comments) {
    if (c.authorLogin && c.authorLogin.trim() !== '') set.add(c.authorLogin);
  }
  return set;
}
