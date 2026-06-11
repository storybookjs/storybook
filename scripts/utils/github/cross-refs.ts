import memoize from 'memoizerific';

import type { GithubClient } from './client.ts';

export interface CrossRefEvent {
  prNumber: number;
  prState: 'open' | 'closed';
  merged: boolean;
}

interface IssueCoords {
  owner: string;
  repo: string;
  number: number;
}

async function fetchCrossRefsImpl(
  client: GithubClient,
  issue: IssueCoords
): Promise<CrossRefEvent[]> {
  const data = await client.graphql<any>(
    `query($owner:String!,$repo:String!,$num:Int!){
      repository(owner:$owner,name:$repo){
        issue(number:$num){
          timelineItems(first:100, itemTypes:[CROSS_REFERENCED_EVENT]){
            nodes{ ... on CrossReferencedEvent { source { ... on PullRequest { number state merged } } } }
          }
        }
      }
    }`,
    { owner: issue.owner, repo: issue.repo, num: issue.number }
  );
  const nodes = data.repository?.issue?.timelineItems?.nodes ?? [];
  const out: CrossRefEvent[] = [];
  for (const node of nodes) {
    const src = node?.source;
    if (!src || typeof src.number !== 'number') continue;
    out.push({
      prNumber: src.number,
      prState: src.state === 'OPEN' ? 'open' : 'closed',
      merged: Boolean(src.merged),
    });
  }
  return out;
}

/**
 * Fetch every PR that references a given GitHub issue (the issue's
 * cross-referenced-event timeline). Memoized: a single (client, issue) pair
 * resolves to one network call per process for the cache's lifetime.
 *
 * Memoization key is by argument identity, so callers that pass a fresh client
 * (e.g., in tests) get a fresh cache slot — there's no cross-test leakage.
 */
export const fetchCrossRefs = memoize(50)(fetchCrossRefsImpl);
