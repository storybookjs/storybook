export interface TeamCoordinates {
  org: string;
  slugs: readonly string[];
}

/**
 * Check active membership directly instead of listing a team's members and relying on pagination.
 */
export async function isMemberOfAnyTeam(
  login: string,
  teams: TeamCoordinates,
  token: string,
  fetchImpl: typeof fetch = fetch
): Promise<boolean> {
  for (const slug of teams.slugs) {
    const response = await fetchImpl(
      `https://api.github.com/orgs/${teams.org}/teams/${slug}/memberships/${encodeURIComponent(login)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );

    if (response.status === 404) {
      continue;
    }
    if (!response.ok) {
      throw new Error(`GitHub team membership request failed with status ${response.status}`);
    }

    const membership = (await response.json()) as { state?: string };
    if (membership.state === 'active') {
      return true;
    }
  }

  return false;
}
