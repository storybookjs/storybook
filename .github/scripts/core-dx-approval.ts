import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isMemberOfAnyTeam } from '../../scripts/utils/github/teams.ts';

const STATUS_CONTEXT = 'Core/DX approval';
const TRUSTED_TEAMS = { org: 'storybookjs', slugs: ['core', 'developer-experience'] } as const;
const QUERY = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        author { login }
        headRefOid
        latestOpinionatedReviews(first: 100, writersOnly: true) {
          nodes { state author { login } }
        }
        commits(last: 1) {
          nodes { commit { status { context(name: "${STATUS_CONTEXT}") { state } } } }
        }
      }
    }
  }
`;

export type PullRequest = {
  author: { login: string } | null;
  headRefOid: string;
  latestOpinionatedReviews: { nodes: { state: string; author: { login: string } | null }[] };
  commits: { nodes: { commit: { status: { context: { state: string } | null } | null } }[] };
};

export type Status = { state: 'success' | 'pending'; description: string };

export async function syncStatus(
  pullRequest: PullRequest,
  isTrusted: (login: string) => Promise<boolean>,
  postStatus: (status: Status) => void
): Promise<void> {
  const author = pullRequest.author?.login.toLowerCase();
  const approvers = pullRequest.latestOpinionatedReviews.nodes.flatMap((review) =>
    review.state === 'APPROVED' && review.author && review.author.login.toLowerCase() !== author
      ? [review.author.login]
      : []
  );
  const isReported = pullRequest.commits.nodes[0].commit.status?.context?.state === 'SUCCESS';

  let trusted: string[] = [];
  try {
    const checks = await Promise.all(approvers.map(isTrusted));
    trusted = approvers.filter((_, index) => checks[index]);
  } finally {
    if (trusted.length > 0 && !isReported) {
      postStatus({ state: 'success', description: `Approved by ${trusted.join(', ')}` });
    }
    // A status cannot be deleted, so an approval that no longer stands is downgraded to pending.
    if (trusted.length === 0 && isReported) {
      postStatus({ state: 'pending', description: 'Waiting for a Core or DX approval' });
    }
  }
}

function gh(...args: string[]): string {
  return execFileSync('gh', ['api', ...args], { encoding: 'utf8' });
}

async function main(numbers: string[]): Promise<void> {
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
  const membershipToken = process.env.ORG_MEMBERSHIP_TOKEN ?? '';

  for (const number of numbers) {
    try {
      const variables = ['-f', `owner=${owner}`, '-f', `repo=${repo}`, '-F', `number=${number}`];
      const pullRequest: PullRequest = JSON.parse(
        gh('graphql', '-f', `query=${QUERY}`, ...variables)
      ).data.repository.pullRequest;

      await syncStatus(
        pullRequest,
        (login) => isMemberOfAnyTeam(login, TRUSTED_TEAMS, membershipToken),
        ({ state, description }) => {
          console.log(`PR #${number}: ${state} (${description})`);
          gh(
            `repos/${owner}/${repo}/statuses/${pullRequest.headRefOid}`,
            ...['-f', `context=${STATUS_CONTEXT}`, '-f', `state=${state}`],
            ...['-f', `description=${description.slice(0, 140)}`]
          );
        }
      );
    } catch (error) {
      console.error(`PR #${number}: ${String(error)}`);
      process.exitCode = 1;
    }
  }
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
