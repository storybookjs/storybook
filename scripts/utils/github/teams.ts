import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';
import { MAINTAINER_TEAM_SLUGS, ORG } from './constants.ts';

function isHttpError(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false;
  return (err as { status: unknown }).status === status;
}

async function isMaintainerImpl(login: string): Promise<boolean> {
  if (!login) return false;
  const client = getGithubClient();
  for (const team of MAINTAINER_TEAM_SLUGS) {
    try {
      const { data } = await client.rest(
        'GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
        { org: ORG, team_slug: team, username: login }
      );
      if (data?.state === 'active') return true;
    } catch (err: unknown) {
      if (isHttpError(err, 404)) continue;
      throw err;
    }
  }
  return false;
}

/**
 * Returns `true` if `login` is an active member of any maintainer team. 404s
 * on a single team are treated as "not a member of that team" (we walk to
 * the next slug); any other error propagates so the caller doesn't silently
 * downgrade auth or org-name mistakes to "non-maintainer". Memoized by
 * login.
 */
export const isMaintainer = memoize(1000)(isMaintainerImpl);

async function listTeamMembersImpl(team: {
  org: string;
  slug: string;
}): Promise<readonly string[]> {
  const client = getGithubClient();
  const members: string[] = [];
  let page = 1;
  while (true) {
    const { data } = await client.rest('GET /orgs/{org}/teams/{team_slug}/members', {
      org: team.org,
      team_slug: team.slug,
      per_page: 100,
      page,
    });
    if (data.length === 0) break;
    for (const m of data) {
      if (m.login) members.push(m.login);
    }
    if (data.length < 100) break;
    page += 1;
  }
  return members;
}

/**
 * List every member of a single GitHub team. Paginated, memoized per
 * `{ org, slug }` identity. Use {@link listMaintainerLogins} when you need
 * the union across the canonical maintainer teams.
 */
export const listTeamMembers = memoize(1000)(listTeamMembersImpl);

/**
 * Union of every login across the maintainer teams, deduped. Cheaper than
 * `N × isMaintainer` probes when you need to filter a list of users against
 * the maintainer set (e.g., the comment-participants signal in
 * cost-benefit).
 */
export async function listMaintainerLogins(): Promise<Set<string>> {
  const lists = await Promise.all(
    MAINTAINER_TEAM_SLUGS.map((slug) => listTeamMembers({ org: ORG, slug }))
  );
  return new Set(lists.flat());
}
