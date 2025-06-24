import type { GraphQlQueryResponseData } from '@octokit/graphql';
import { graphql } from '@octokit/graphql';
import { request } from '@octokit/request';

export interface PullRequest {
  number: number;
  id: string;
  branch: string;
  title: string;
  mergeCommit: string;
}

export const githubGraphQlClient = graphql.defaults({
  headers: { authorization: `token ${process.env.GH_TOKEN}` },
});

export const githubRestClient = request.defaults({
  request: {
    fetch,
  },
  headers: { authorization: `token ${process.env.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
});

export async function getUnpickedPRs(
  baseBranch: string,
  verbose?: boolean
): Promise<Array<PullRequest>> {
  console.log(`💬 Getting unpicked patch pull requests...`);
  const result = await githubGraphQlClient<GraphQlQueryResponseData>(
    `
      query ($owner: String!, $repo: String!, $state: PullRequestState!, $order: IssueOrder!) {
        repository(owner: $owner, name: $repo) {
          pullRequests(states: [$state], labels: ["patch:yes"], orderBy: $order, first: 50, baseRefName: "next") {
            nodes {
              id
              number
              title
              baseRefName
              mergeCommit { 
                oid
              }
              labels(first: 20) {
                nodes {
                  name
                }
              }
            }
          }
        }
      }
    `,
    {
      owner: 'storybookjs',
      repo: 'storybook',
      order: {
        field: 'UPDATED_AT',
        direction: 'DESC',
      },
      state: 'MERGED',
    }
  );

  const {
    pullRequests: { nodes },
  } = result.repository;

  const prs = nodes.map((node: any) => ({
    number: node.number,
    id: node.id,
    branch: node.baseRefName,
    title: node.title,
    mergeCommit: node.mergeCommit.oid,
    labels: node.labels.nodes.map((l: any) => l.name),
  }));

  const unpickedPRs = prs
    .filter((pr: any) => !pr.labels.includes('patch:done'))
    .filter((pr: any) => pr.branch === baseBranch)
    .reverse();

  if (verbose) {
    console.log(`🔍 Found unpicked patch pull requests:
  ${JSON.stringify(unpickedPRs, null, 2)}`);
  }
  return unpickedPRs;
}

export async function getLabelIds({
  repo: fullRepo,
  labelNames,
}: {
  labelNames: string[];
  repo: string;
}) {
  const query = labelNames.join('+');
  const [owner, repo] = fullRepo.split('/');
  const result = await githubGraphQlClient<GraphQlQueryResponseData>(
    `
      query ($owner: String!, $repo: String!, $q: String!) {
        repository(owner: $owner, name: $repo) {
          labels(query: $q, first: 10) {
            nodes {
              id
              name
              description
            }
          }
        }
      }
    `,
    { owner, repo, q: query }
  );

  const { labels } = result.repository;
  const labelToId: Record<string, string> = {};
  labels.nodes.forEach((label: { name: string; id: string }) => {
    labelToId[label.name] = label.id;
  });
  return labelToId;
}
