import { graphql } from '@octokit/graphql';
import { request } from '@octokit/request';

const TOKEN_VARS = ['GH_TOKEN', 'GITHUB_TOKEN'] as const;

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
