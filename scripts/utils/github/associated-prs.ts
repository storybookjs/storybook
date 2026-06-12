import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

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

export interface CommitWithPr {
  commit: string;
  commitUrl: string | null;
  commitAuthor: { login: string; url: string } | null;
  pr: AssociatedPr | null;
}

interface CommitNode {
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
}

interface BatchResponse {
  repository: Record<string, CommitNode | null>;
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

function pickLatestMerged(prs: AssociatedPr[]): AssociatedPr | null {
  if (prs.length === 0) return null;
  return [...prs].sort((a, b) => {
    if (a.mergedAt === null && b.mergedAt === null) return 0;
    if (a.mergedAt === null) return 1;
    if (b.mergedAt === null) return -1;
    return new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime();
  })[0];
}

function nodeToCommitWithPr(commit: string, node: CommitNode | null): CommitWithPr {
  if (!node) return { commit, commitUrl: null, commitAuthor: null, pr: null };
  const prs: AssociatedPr[] = (node.associatedPullRequests?.nodes ?? []).map((n) => ({
    id: n.id,
    number: n.number,
    title: n.title,
    state: n.state,
    url: n.url,
    mergedAt: n.mergedAt,
    author: n.author ? { login: n.author.login, url: n.author.url } : null,
    labels: (n.labels?.nodes ?? []).map((l) => l.name),
  }));
  return {
    commit,
    commitUrl: node.commitUrl ?? null,
    commitAuthor: node.author?.user ?? null,
    pr: pickLatestMerged(prs),
  };
}

async function getLatestMergedPrsFromCommitsImpl(input: {
  repo: string;
  commits: readonly string[];
}): Promise<CommitWithPr[]> {
  if (input.commits.length === 0) return [];
  if (!input.repo) {
    throw new Error('getLatestMergedPrsFromCommits: repo is required.');
  }
  if (!REPO_RE.test(input.repo)) {
    throw new Error(
      `getLatestMergedPrsFromCommits: repo must be in the form owner/name (got ${JSON.stringify(input.repo)}).`
    );
  }
  for (const c of input.commits) {
    if (!c) throw new Error('getLatestMergedPrsFromCommits: every commit SHA must be a non-empty string.');
  }

  const [owner, name] = input.repo.split('/');
  // Build one GraphQL query that fans out across every commit via aliased
  // `object(oid: ...)` subfields. A single round-trip — much cheaper than
  // `Promise.all(commits.map(...))` on hot release flows.
  const subfields = input.commits
    .map(
      (commit, i) => `
      c${i}: object(oid: ${JSON.stringify(commit)}) {
        ... on Commit {
          commitUrl
          author { user { login url } }
          associatedPullRequests(first: 50) {
            nodes {
              id number title state url mergedAt
              labels(first: 50) { nodes { name } }
              author { ... on User { login url } ... on Bot { login url } }
            }
          }
        }
      }`
    )
    .join('\n');

  const query = `query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      ${subfields}
    }
  }`;

  const client = getGithubClient();
  const data = await client.graphql<BatchResponse>(query, { owner, name });

  return input.commits.map((commit, i) => nodeToCommitWithPr(commit, data.repository[`c${i}`] ?? null));
}

/**
 * Look up the latest-merged PR associated with each commit in a single
 * GraphQL round-trip. Returns one `CommitWithPr` per input commit, in the
 * same order — `pr` is `null` for commits with no associated PR (or no PR
 * we could resolve). Memoized by `{ repo, commits }` identity.
 *
 * Replaces the per-commit `getPullInfoFromCommit` + Promise.all pattern from
 * the legacy release flow: batching all the lookups into one query is
 * substantially cheaper when the changelog walks 50–100 commits at a time.
 */
export const getLatestMergedPrsFromCommits = memoize(1000)(getLatestMergedPrsFromCommitsImpl);
