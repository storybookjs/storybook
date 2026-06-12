import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

/**
 * A PR that GitHub has associated with a commit, with the fields we care
 * about for changelog rendering. This is intentionally a small shape — if a
 * caller needs more, fetch through `fetchPr` (REST) or extend the GraphQL
 * query here.
 */
export interface AssociatedPr {
  id: string;
  number: number;
  title: string;
  state: string;
  url: string;
  mergedAt: string | null;
  author: { login: string; url: string } | null;
  labels: string[];
}

interface CommitResponse {
  repository: {
    object: {
      commitUrl?: string;
      author?: { user?: { login: string; url: string } | null };
      associatedPullRequests?: {
        nodes: Array<{
          id: string;
          number: number;
          title: string;
          state: string;
          url: string;
          mergedAt: string | null;
          labels?: { nodes: Array<{ name: string }> };
          author?: { login: string; url: string } | null;
        }>;
      };
    } | null;
  };
}

export interface CommitContext {
  commitUrl: string | null;
  commitAuthor: { login: string; url: string } | null;
  associatedPrs: AssociatedPr[];
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

async function getAssociatedPrsImpl(input: {
  repo: string;
  commit: string;
}): Promise<CommitContext> {
  if (!input.commit) throw new Error('getAssociatedPrs: commit SHA is required.');
  if (!input.repo) throw new Error('getAssociatedPrs: repo is required.');
  if (!REPO_RE.test(input.repo)) {
    throw new Error(
      `getAssociatedPrs: repo must be in the form owner/name (got ${JSON.stringify(input.repo)}).`
    );
  }

  const [owner, name] = input.repo.split('/');
  const client = getGithubClient();
  const data = await client.graphql<CommitResponse>(
    `query($owner:String!,$name:String!,$oid:GitObjectID!){
      repository(owner:$owner,name:$name){
        object(oid:$oid){
          ... on Commit {
            commitUrl
            author { user { login url } }
            associatedPullRequests(first:50){
              nodes {
                id number title state url mergedAt
                labels(first:50){ nodes { name } }
                author { ... on User { login url } ... on Bot { login url } }
              }
            }
          }
        }
      }
    }`,
    { owner, name, oid: input.commit }
  );

  const commit = data.repository.object;
  if (!commit) {
    return { commitUrl: null, commitAuthor: null, associatedPrs: [] };
  }

  const associatedPrs: AssociatedPr[] = (commit.associatedPullRequests?.nodes ?? []).map(
    (node) => ({
      id: node.id,
      number: node.number,
      title: node.title,
      state: node.state,
      url: node.url,
      mergedAt: node.mergedAt,
      author: node.author ? { login: node.author.login, url: node.author.url } : null,
      labels: (node.labels?.nodes ?? []).map((l) => l.name),
    })
  );

  return {
    commitUrl: commit.commitUrl ?? null,
    commitAuthor: commit.author?.user ?? null,
    associatedPrs,
  };
}

/**
 * Fetch the commit URL, the commit's user-author (if any), and every PR
 * GitHub has associated with the commit. Used by the release flow to map
 * cherry-picked commits back to their source PRs for changelog rendering.
 * Memoized by `{ repo, commit }` identity.
 */
export const getAssociatedPrs = memoize(1000)(getAssociatedPrsImpl);

/**
 * Pick the PR with the latest `mergedAt` timestamp. PRs that have not been
 * merged sort to the end. Returns `null` for an empty input.
 *
 * Matches the legacy `getPullInfoFromCommit` selection logic: when a commit
 * is associated with multiple PRs (e.g., the original and a backport), the
 * most-recently merged one is the one we attribute the change to.
 */
export function pickLatestMergedPr(prs: AssociatedPr[]): AssociatedPr | null {
  if (prs.length === 0) return null;
  const sorted = [...prs].sort((a, b) => {
    if (a.mergedAt === null && b.mergedAt === null) return 0;
    if (a.mergedAt === null) return 1;
    if (b.mergedAt === null) return -1;
    return new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime();
  });
  return sorted[0];
}
