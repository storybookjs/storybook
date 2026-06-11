import type { GithubClient } from './client.ts';

export interface TeamMembership {
  isMaintainer(login: string): Promise<boolean>;
}

/**
 * Build a team-membership probe for `org`. Returns `true` if the user is an
 * active member of any of the given team slugs. 404s on a single team are
 * treated as "not a member of that team" (we walk to the next slug); any other
 * error propagates so the caller doesn't silently downgrade auth or org-name
 * mistakes to "non-maintainer".
 */
export function teamMembership(
  client: GithubClient,
  org: string,
  teamSlugs: readonly string[]
): TeamMembership {
  return {
    async isMaintainer(login) {
      if (!login) return false;
      for (const team of teamSlugs) {
        try {
          const { data } = await client.rest(
            'GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
            { org, team_slug: team, username: login }
          );
          if (data?.state === 'active') return true;
        } catch (err: any) {
          if (err?.status === 404) continue;
          throw err;
        }
      }
      return false;
    },
  };
}
