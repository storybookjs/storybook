import { MAINTAINER_TEAM_SLUGS, ORG } from '../config.ts';
import type { GithubClient } from './client.ts';

export interface TeamMembership {
  isMaintainer(login: string): Promise<boolean>;
}

export function githubTeamMembership(client: GithubClient): TeamMembership {
  return {
    async isMaintainer(login) {
      if (!login) return false;
      for (const team of MAINTAINER_TEAM_SLUGS) {
        try {
          const { data } = await client.rest(
            'GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
            {
              org: ORG,
              team_slug: team,
              username: login,
            }
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
