import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

export interface IssueOrPrComment {
  authorLogin: string | null;
  createdAt: string;
  body: string;
  /**
   * `true` if the commenter is a GitHub App / bot. Detected from the REST
   * `user.type === 'Bot'` field (canonical) with a defensive `[bot]`
   * suffix fallback for the rare case where a bot slips through with an
   * unset `type`. Callers use this to strip bot noise before counting
   * popularity signals.
   */
  isBot: boolean;
}

interface IssueCoords {
  owner: string;
  repo: string;
  number: number;
}

function looksLikeBotLogin(login: string | null): boolean {
  return typeof login === 'string' && login.endsWith('[bot]');
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
      const login = c.user?.login ?? null;
      comments.push({
        authorLogin: login,
        createdAt: c.created_at,
        body: c.body ?? '',
        isBot: c.user?.type === 'Bot' || looksLikeBotLogin(login),
      });
    }
    if (data.length < 100) break;
    page += 1;
  }
  return comments;
}

/**
 * Fetch all comments on a GitHub issue or PR. The REST
 * `/issues/{n}/comments` endpoint covers both — PRs share the issue ID
 * space, and this endpoint returns the timeline "issue comments" on the PR
 * (NOT the code-review comments, which live on a separate endpoint and are
 * almost entirely maintainer noise for our purposes). Paginated. Memoized by
 * coords identity.
 */
export const getIssueOrPrComments = memoize(1000)(getIssueOrPrCommentsImpl);

/**
 * Extract the set of unique human authors from a comment list. Drops:
 *   - Null / empty-string logins (defensive; happens for comments left by
 *     deleted accounts).
 *   - Bot accounts (per {@link IssueOrPrComment.isBot}).
 *   - Any login present in `ignore` (typically the union of maintainers,
 *     the issue author, and the PR author — anyone whose participation
 *     shouldn't count as external popularity signal).
 *
 * Returns a `Set<string>` so callers can `.union()` results across
 * multiple issues without re-deduping manually.
 */
export function getUniqueParticipants(
  comments: readonly IssueOrPrComment[],
  ignore: Iterable<string | null | undefined> = []
): Set<string> {
  const ignoreSet = new Set<string>();
  for (const v of ignore) {
    if (v) ignoreSet.add(v);
  }
  const set = new Set<string>();
  for (const login of comments
    .filter((c) => !c.isBot)
    .map((c) => c.authorLogin)
    .filter((login) => login && login.trim() !== '')
    .filter((login) => !ignoreSet.has(login))) {
    set.add(login);
  }
  return set;
}
