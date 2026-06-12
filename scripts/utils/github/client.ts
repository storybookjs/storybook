/**
 * GitHub client factory + process-wide accessor.
 *
 * Every script that talks to GitHub should consume `getGithubClient()`.
 * `createGithubClient(token)` is the lower-level factory; the only reason it's
 * exported is so callers in unusual environments (e.g., one-off scripts that
 * already have a token in hand) can build a client directly.
 */
import { graphql } from '@octokit/graphql';
import { request } from '@octokit/request';

const TOKEN_VARS = ['GH_TOKEN', 'GITHUB_TOKEN'] as const;

/**
 * Default scopes used when a caller doesn't pass anything specific. Surfaced
 * in the missing-token error message; the actual scopes are enforced by
 * GitHub. Domain-specific tools (e.g., assess-mvc) export their own narrower
 * scope list and pass it through to surface a more targeted error.
 */
export const DEFAULT_GITHUB_SCOPES = Object.freeze([
  'repo (or fine-grained: contents:read, pull_requests:read, issues:read)',
]);

export interface GithubClient {
  graphql: typeof graphql;
  rest: typeof request;
}

/**
 * Resolve a GitHub token from the environment, or throw with a usage error
 * naming the scopes the caller needs.
 *
 * Both `GH_TOKEN` (used by `gh`) and `GITHUB_TOKEN` (used by GitHub Actions)
 * are accepted; `GH_TOKEN` wins when both are set so local `gh auth token`
 * runs override workflow defaults.
 */
export function requireToken(
  scopes: readonly string[],
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): string {
  for (const key of TOKEN_VARS) {
    const value = env[key];
    if (value && value.trim() !== '') return value;
  }
  throw new Error(
    `No GitHub token found. Set GH_TOKEN or GITHUB_TOKEN. Required scopes: ${scopes.join(', ')}.`
  );
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

let _client: GithubClient | null = null;

/**
 * GitHub scopes required by the release flow. Release scripts manage labels,
 * cancel workflow runs, and read PR/issue history, so they need `repo` +
 * `workflow`.
 */
export const RELEASE_SCOPES = Object.freeze(['repo', 'workflow']);

/**
 * GitHub scopes required by the assess-mvc CLI.
 */
export const ASSESS_MVC_SCOPES = Object.freeze([
  'pull_requests:write',
  'issues:read',
  'contents:read',
  'members:read (org)',
]);

/**
 * Process-wide GitHub client accessor. Lazy: the first call resolves the
 * token from the environment and builds a client; subsequent calls return
 * the same instance regardless of arguments. This is what every check / util
 * should consume — pass a scopes constant so the missing-token error is
 * specific to your tool.
 */
export function getGithubClient(scopes: readonly string[] = DEFAULT_GITHUB_SCOPES): GithubClient {
  if (!_client) {
    _client = createGithubClient(requireToken(scopes));
  }
  return _client;
}

/**
 * Reset the cached client. Test-only: msw setup calls this between tests so
 * each spec starts with a clean slate.
 */
export function resetGithubClient(): void {
  _client = null;
}
