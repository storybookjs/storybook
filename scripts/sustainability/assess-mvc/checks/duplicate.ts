import type { GithubClient } from '../../../utils/github/client.ts';
import type { CheckResult, LinkedIssue } from '../types.ts';

export interface CrossRefEvent {
  prNumber: number;
  prState: 'open' | 'closed';
  merged: boolean;
}

export interface TimelineEvent {
  type: 'closed' | 'reopened' | string;
  at: string;
}

export type DuplicateLookup = (
  issue: Pick<LinkedIssue, 'owner' | 'repo' | 'number'>
) => Promise<{
  crossRefs: CrossRefEvent[];
  timeline: TimelineEvent[];
}>;

export async function checkDuplicate(
  selfPrNumber: number,
  linkedIssues: Array<Pick<LinkedIssue, 'owner' | 'repo' | 'number' | 'state' | 'url'>>,
  lookup: DuplicateLookup
): Promise<CheckResult> {
  if (linkedIssues.length === 0) {
    return {
      id: 'duplicate',
      status: 'pass',
      evidence: 'No linked issues; duplicate check is moot.',
    };
  }

  const conflicts: string[] = [];
  for (const issue of linkedIssues) {
    const { crossRefs, timeline } = await lookup(issue);
    const wasReopened = isClosedThenReopened(timeline);
    for (const ref of crossRefs) {
      if (ref.prNumber === selfPrNumber) continue;
      if (ref.prState === 'open' && !ref.merged) {
        conflicts.push(
          `#${ref.prNumber} (open) references the same issue ${issue.owner}/${issue.repo}#${issue.number}`
        );
      } else if (ref.merged && !wasReopened) {
        conflicts.push(
          `#${ref.prNumber} (merged) already fixed ${issue.owner}/${issue.repo}#${issue.number}`
        );
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      id: 'duplicate',
      status: 'fail',
      evidence: conflicts.join('; '),
      guidance:
        'Another PR is already addressing this issue. Consider commenting on / contributing to that PR instead.',
    };
  }

  return {
    id: 'duplicate',
    status: 'pass',
    evidence: 'No conflicting PRs found on the linked issue(s).',
  };
}

function isClosedThenReopened(timeline: TimelineEvent[]): boolean {
  let sawClosed = false;
  for (const event of timeline) {
    if (event.type === 'closed') sawClosed = true;
    if (event.type === 'reopened' && sawClosed) return true;
  }
  return false;
}

export function githubDuplicateLookup(client: GithubClient): DuplicateLookup {
  return async (issue) => {
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
    const crossRefs: CrossRefEvent[] = [];
    for (const node of nodes) {
      const src = node?.source;
      if (!src || typeof src.number !== 'number') continue;
      crossRefs.push({
        prNumber: src.number,
        prState: src.state === 'OPEN' ? 'open' : 'closed',
        merged: Boolean(src.merged),
      });
    }
    const { data: timeline } = await client.rest(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/timeline',
      {
        owner: issue.owner,
        repo: issue.repo,
        issue_number: issue.number,
        per_page: 100,
      }
    );
    const timelineEvents: TimelineEvent[] = (timeline as any[]).map((e: any) => ({
      type: e.event,
      at: e.created_at,
    }));
    return { crossRefs, timeline: timelineEvents };
  };
}
