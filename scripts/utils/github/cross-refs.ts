import memoize from 'memoizerific';

import { getGithubClient } from './client.ts';

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

interface CrossRefsResponse {
  repository?: {
    issue?: {
      timelineItems?: {
        nodes?: Array<{
          source?: { number?: number; state?: 'OPEN' | 'CLOSED'; merged?: boolean };
        }>;
      };
    };
  };
}

async function fetchCrossRefsImpl(issue: IssueCoords): Promise<CrossRefEvent[]> {
  const client = getGithubClient();
  const data = await client.graphql<CrossRefsResponse>(
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
  return nodes
    .map((node) => node.source)
    .filter((src): src is NonNullable<typeof src> => Boolean(src) && typeof src?.number === 'number')
    .map((src) => ({
      prNumber: src.number as number,
      prState: src.state === 'OPEN' ? 'open' : 'closed',
      merged: Boolean(src.merged),
    }));
}

/**
 * Fetch every PR that references a given GitHub issue (the issue's
 * cross-referenced-event timeline). Memoized by issue identity for the
 * process lifetime.
 */
export const fetchCrossRefs = memoize(1000)(fetchCrossRefsImpl);
