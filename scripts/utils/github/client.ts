/**
 * Octokit factory + token resolution for every script that talks to GitHub.
 *
 * NOTE on duplication: `scripts/utils/githubClient.ts` (a fetch-based GraphQL
 * client) is dead code at the time of writing; `scripts/release/utils/github-client.ts`
 * uses a module-load-time static client tied to `process.env.GH_TOKEN`. Both
 * predate this module; consolidate when those areas are next touched.
 */
import { graphql } from '@octokit/graphql';
import { request } from '@octokit/request';

const TOKEN_VARS = ['GH_TOKEN', 'GITHUB_TOKEN'] as const;

/**
 * Resolve a GitHub token from the environment. Both `GH_TOKEN` (used by `gh`)
 * and `GITHUB_TOKEN` (used by GitHub Actions) are accepted; `GH_TOKEN` wins
 * when both are set so local `gh auth token` runs override workflow defaults.
 * Throws with the required-scopes list rather than returning undefined — every
 * caller treats no-token as a fatal usage error.
 */
export function requireToken(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string {
  for (const key of TOKEN_VARS) {
    const value = env[key];
    if (value && value.trim() !== '') return value;
  }
  throw new Error(
    'No GitHub token found. Set GH_TOKEN or GITHUB_TOKEN. Required scopes: pull_requests:read+write, issues:read+write, contents:read, members:read (org).'
  );
}

export interface GithubClient {
  graphql: typeof graphql;
  rest: typeof request;
}

/**
 * Build a `{ graphql, rest }` octokit client with the given token baked in as
 * a default header. We expose both flavours because some queries (closing-
 * issue references, cross-references) only exist in GraphQL while the REST
 * API has better pagination ergonomics for files/timeline endpoints.
 */
export function createGithubClient(token: string): GithubClient {
  return {
    graphql: graphql.defaults({ headers: { authorization: `token ${token}` } }),
    rest: request.defaults({
      headers: {
        authorization: `token ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }),
  };
}
