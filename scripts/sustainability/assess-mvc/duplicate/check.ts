import { fetchCrossRefs } from '../../../utils/github/cross-refs.ts';
import type { CheckResult, PrContext } from '../types.ts';

/**
 * PURPOSE: Prevents dozens of PRs from being created for the same issue.
 * We should have a single contribution at a time to address an issue.
 *
 * TYPE: Deterministic.
 *
 * FAILS IF:
 * - There is an open linked issue with open PRs created before this PR.
 * - There is a linked issue but it is already closed.
 *
 * Merged and closed PRs that reference the same issue are ignored if it is
 * still open, as this is a sign previously merged PRs didn't fully address
 * the issue.
 */
export async function checkDuplicate(
  pr: Pick<PrContext, 'number' | 'linkedIssues'>
): Promise<CheckResult> {
  if (pr.linkedIssues.length === 0) {
    return {
      id: 'duplicate',
      status: 'pass',
      reasoning: 'No linked issues; duplicate check is moot.',
    };
  }

  const closedIssues = pr.linkedIssues.filter((i) => i.state === 'closed');
  if (closedIssues.length > 0) {
    const list = closedIssues.map((i) => `${i.owner}/${i.repo}#${i.number}`).join(', ');
    return {
      id: 'duplicate',
      status: 'fail',
      reasoning: `Linked issue(s) ${list} are already closed — the problem is resolved.`,
      guidance: 'If this issue regressed, please re-open it (or open a fresh one and link that).',
    };
  }

  const conflicts: string[] = [];
  for (const issue of pr.linkedIssues) {
    const crossRefs = await fetchCrossRefs(issue);
    for (const ref of crossRefs) {
      if (ref.prNumber === pr.number) continue;
      if (ref.prState === 'open' && !ref.merged && ref.prNumber < pr.number) {
        conflicts.push(
          `#${ref.prNumber} (open, predates this PR) references ${issue.owner}/${issue.repo}#${issue.number}`
        );
      }
    }
  }

  if (conflicts.length > 0) {
    return {
      id: 'duplicate',
      status: 'fail',
      reasoning: conflicts.join('; '),
      guidance:
        'An older open PR is already addressing this issue. Consider commenting on / contributing to that PR instead.',
    };
  }

  return {
    id: 'duplicate',
    status: 'pass',
    reasoning: 'No conflicting open PR found on the linked issue(s).',
  };
}
