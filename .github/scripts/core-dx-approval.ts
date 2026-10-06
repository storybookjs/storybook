import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getLatestOpinionatedReviews } from '../../scripts/utils/github/reviews.ts';
import { isMemberOfAnyTeam } from '../../scripts/utils/github/teams.ts';

export const STATUS_CONTEXT = 'Core/DX approval';
const TRUSTED_REVIEWER_TEAMS = {
  org: 'storybookjs',
  slugs: ['core', 'developer-experience'],
} as const;

export type PullRequest = {
  number: number;
  user: { login: string };
  head: { sha: string };
};

export type GitHub = {
  rest: <Response>(path: string, body?: unknown) => Promise<Response>;
  graphql: <Response>(
    query: string,
    variables: Record<string, string | number>
  ) => Promise<Response>;
  isTrustedReviewer: (login: string) => Promise<boolean>;
};

export type ApprovalOutcome = 'approved' | 'revoked' | 'unchanged';

async function findCurrentState(
  github: GitHub,
  repository: string,
  sha: string
): Promise<string | undefined> {
  for (let page = 1; ; page++) {
    const { statuses } = await github.rest<{ statuses: { context: string; state: string }[] }>(
      `/repos/${repository}/commits/${sha}/status?per_page=100&page=${page}`
    );
    const status = statuses.find(({ context }) => context === STATUS_CONTEXT);
    if (status || statuses.length < 100) {
      return status?.state;
    }
  }
}

export async function syncApprovalStatus(
  github: GitHub,
  repository: string,
  pullRequest: PullRequest
): Promise<ApprovalOutcome> {
  const currentState = await findCurrentState(github, repository, pullRequest.head.sha);
  const postStatus = (state: 'success' | 'pending', description: string) =>
    github.rest(`/repos/${repository}/statuses/${pullRequest.head.sha}`, {
      context: STATUS_CONTEXT,
      state,
      description,
    });

  let trustedApprovers: string[];
  try {
    trustedApprovers = await findTrustedApprovers(github, repository, pullRequest);
  } catch (error) {
    if (currentState === 'success') {
      await postStatus('pending', 'Could not verify the approval, re-run the Core/DX Approval job');
    }
    throw error;
  }

  if (trustedApprovers.length > 0) {
    if (currentState !== 'success') {
      await postStatus('success', `Approved by ${trustedApprovers.join(', ')}`.slice(0, 140));
    }
    return 'approved';
  }

  // A status cannot be deleted, so an approval that no longer stands is downgraded to pending.
  if (currentState === 'success') {
    await postStatus('pending', 'Waiting for an approval from Core or Developer Experience');
    return 'revoked';
  }
  return 'unchanged';
}

async function findTrustedApprovers(
  github: GitHub,
  repository: string,
  pullRequest: PullRequest
): Promise<string[]> {
  const [owner, repo] = repository.split('/');
  const reviews = await getLatestOpinionatedReviews(github.graphql, {
    owner,
    repo,
    number: pullRequest.number,
  });
  const author = pullRequest.user.login.toLowerCase();
  const approvers = reviews.flatMap((review) =>
    review.state === 'APPROVED' && review.authorLogin.toLowerCase() !== author
      ? [review.authorLogin]
      : []
  );
  const trusted = await Promise.all(
    approvers.map(async (login) => ((await github.isTrustedReviewer(login)) ? [login] : []))
  );
  return trusted.flat();
}

export type Target =
  | { number: string }
  | { headOwner: string; headBranch: string }
  | { allApproved: true };

export async function findPullRequests(
  github: GitHub,
  repository: string,
  target: Target
): Promise<PullRequest[]> {
  if ('number' in target) {
    return [await github.rest<PullRequest>(`/repos/${repository}/pulls/${Number(target.number)}`)];
  }
  if ('headOwner' in target) {
    const head = encodeURIComponent(`${target.headOwner}:${target.headBranch}`);
    return github.rest<PullRequest[]>(`/repos/${repository}/pulls?state=open&head=${head}`);
  }
  const query = encodeURIComponent(`repo:${repository} is:pr is:open review:approved`);
  const { items } = await github.rest<{ items: { number: number }[] }>(
    `/search/issues?q=${query}&per_page=100`
  );
  return Promise.all(
    items.map(({ number }) => github.rest<PullRequest>(`/repos/${repository}/pulls/${number}`))
  );
}

function createGitHub(token: string, membershipToken: string): GitHub {
  const request = async <Response>(path: string, body?: unknown): Promise<Response> => {
    const response = await fetch(`https://api.github.com${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      throw new Error(`GitHub request to ${path} failed with status ${response.status}`);
    }
    return (await response.json()) as Response;
  };

  return {
    rest: request,
    graphql: async <Response>(query: string, variables: Record<string, string | number>) => {
      const result = await request<{ data?: Response; errors?: { message: string }[] }>(
        '/graphql',
        { query, variables }
      );
      if (!result.data || result.errors?.length) {
        throw new Error(`GitHub GraphQL request failed: ${JSON.stringify(result.errors)}`);
      }
      return result.data;
    },
    isTrustedReviewer: (login) => isMemberOfAnyTeam(login, TRUSTED_REVIEWER_TEAMS, membershipToken),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const repository = requireEnv('REPOSITORY');
  const github = createGitHub(requireEnv('GITHUB_TOKEN'), requireEnv('ORG_MEMBERSHIP_TOKEN'));
  const target: Target = process.env.PR_NUMBER
    ? { number: process.env.PR_NUMBER }
    : process.env.HEAD_BRANCH
      ? { headOwner: requireEnv('HEAD_OWNER'), headBranch: process.env.HEAD_BRANCH }
      : { allApproved: true };

  for (const pullRequest of await findPullRequests(github, repository, target)) {
    const outcome = await syncApprovalStatus(github, repository, pullRequest);
    console.log(`PR #${pullRequest.number} (${pullRequest.head.sha}): ${outcome}`);
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main();
}
