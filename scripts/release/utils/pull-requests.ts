import { getGithubClient } from '../../utils/github/client.ts';

/**
 * GitHub scopes required by the release flow. Surfaced in the missing-token
 * error; actual enforcement happens at GitHub. Release scripts manage labels,
 * cancel workflow runs, and read PR/issue history, so they need `repo` +
 * `workflow`.
 */
export const RELEASE_SCOPES = Object.freeze(['repo', 'workflow']);

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

interface LabelsResponse {
  repository: {
    labels: {
      nodes: Array<{ id: string; name: string; description: string | null }>;
    };
  };
}

export async function getLabelIds({
  repo: fullRepo,
  labelNames,
}: {
  labelNames: string[];
  repo: string;
}): Promise<Record<string, string>> {
  const client = getGithubClient(RELEASE_SCOPES);
  const query = labelNames.join('+');
  const [owner, repo] = fullRepo.split('/');
  const result = await client.graphql<LabelsResponse>(
    `
      query ($owner: String!, $repo: String!, $q: String!) {
        repository(owner: $owner, name: $repo) {
          labels(query: $q, first: 10) {
            nodes { id name description }
          }
        }
      }
    `,
    { owner, repo, q: query }
  );
  const labelToId: Record<string, string> = {};
  for (const label of result.repository.labels.nodes) {
    labelToId[label.name] = label.id;
  }
  return labelToId;
}
