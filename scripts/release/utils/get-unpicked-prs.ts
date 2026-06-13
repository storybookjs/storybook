import { getGithubClient, RELEASE_SCOPES } from '../../utils/github/client.ts';

export interface PullRequest {
  number: number;
  id: string;
  branch: string;
  title: string;
  mergeCommit: string;
}

interface UnpickedPRNode {
  id: string;
  number: number;
  title: string;
  baseRefName: string;
  mergeCommit: { oid: string };
  labels: { nodes: Array<{ name: string }> };
}

interface UnpickedPRsResponse {
  repository: {
    pullRequests: {
      nodes: UnpickedPRNode[];
    };
  };
}

interface InternalPR extends PullRequest {
  labels: string[];
}

/**
 * Fetch every merged `patch:yes` PR on `next` that hasn't yet been cherry-
 * picked (`patch:done` not set) onto the given base branch. The release
 * flow walks this list to decide which patches to apply.
 */
export async function getUnpickedPRs(
  baseBranch: string,
  verbose?: boolean
): Promise<PullRequest[]> {
  console.log(`💬 Getting unpicked patch pull requests...`);
  const client = getGithubClient(RELEASE_SCOPES);
  const result = await client.graphql<UnpickedPRsResponse>(
    `
      query ($owner: String!, $repo: String!, $state: PullRequestState!, $order: IssueOrder!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(states: [$state], labels: ["patch:yes"], orderBy: $order, first: 50, baseRefName: "next") {
            nodes {
              id
              number
              title
              baseRefName
              mergeCommit { oid }
              labels(first: 20) { nodes { name } }
            }
          }
        }
      }
    `,
    {
      owner: 'storybookjs',
      repo: 'storybook',
      order: { field: 'UPDATED_AT', direction: 'DESC' },
      state: 'MERGED',
    }
  );

  const prs: InternalPR[] = result.repository.pullRequests.nodes.map((node) => ({
    number: node.number,
    id: node.id,
    branch: node.baseRefName,
    title: node.title,
    mergeCommit: node.mergeCommit.oid,
    labels: node.labels.nodes.map((l) => l.name),
  }));

  const unpickedPRs = prs
    .filter((pr) => !pr.labels.includes('patch:done'))
    .filter((pr) => pr.branch === baseBranch)
    .reverse();

  if (verbose) {
    console.log(`🔍 Found unpicked patch pull requests:
  ${JSON.stringify(unpickedPRs, null, 2)}`);
  }
  return unpickedPRs;
}
