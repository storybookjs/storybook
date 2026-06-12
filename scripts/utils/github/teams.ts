import { getGithubClient } from './client.ts';
import { MAINTAINER_TEAM_SLUGS, ORG } from './constants.ts';
import { isHttpError } from './utils.ts';

async function getTeamMembershipsImpl(
  org: string,
  teamSlugs: readonly string[],
  username: string
): Promise<string[]> {
  const client = getGithubClient();
  const memberships: string[] = [];
  for (const team of teamSlugs) {
    try {
      const { data } = await client.rest(
        'GET /orgs/{org}/teams/{team_slug}/memberships/{username}',
        { org, team_slug: team, username }
      );
      if (data?.state === 'active') {
        memberships.push(team);
      }
    } catch (err: unknown) {
      if (!isHttpError(err, 404)) {
        throw err;
      }
    }
  }
  return memberships;
}

const getTeamMemberships = memoizerific(1000)(getTeamMembershipsImpl);

/** Check if a username is a member of the storybookjs maintainer teams. */
export async function isMaintainer(username: string) {
  return (await getTeamMemberships(ORG, MAINTAINER_TEAM_SLUGS, username)).length > 0;
}
