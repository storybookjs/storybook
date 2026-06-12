import { fetchCrossRefs } from '../../../utils/github/cross-refs.ts';
import { wasClosedThenReopened } from '../../../utils/github/timeline.ts';
import type { CheckResult, PrContext } from '../types.ts';

/**
 * PURPOSE: a PR that addresses the same issue as another open or merged PR is
 * not a Minimum Viable Contribution. This check runs before any LLM-judged
 * check, so we can early-abort on definitive failures without spending tokens.
 *
 * FAILS WHEN:
 * - There is an older open PR (lower PR number) cross-referencing the same issue
 * - There is a merged PR addressing the same issue (unless the issue was closed
 *   then reopened, indicating the merged PR wasn't sufficient)
 */
export async function checkDuplicate(
  pr: Pick<PrContext, 'number' | 'linkedIssues'>
): Promise<CheckResult> {
  if (pr.linkedIssues.length === 0) {
    return {
      id: 'duplicate',
      status: 'pass',
      evidence: 'No linked issues; duplicate check is moot.',
    };
  }

  const conflicts: string[] = [];
  for (const issue of pr.linkedIssues) {
    const [crossRefs, reopened] = await Promise.all([
      fetchCrossRefs(issue),
      wasClosedThenReopened(issue),
    ]);
    const relevant = crossRefs.filter((ref) => ref.prNumber !== pr.number);
    for (const ref of relevant) {
      const isOlderOpenPr = ref.prState === 'open' && !ref.merged && ref.prNumber < pr.number;
      if (isOlderOpenPr) {
        conflicts.push(
          `#${ref.prNumber} (open, predates this PR) references ${issue.owner}/${issue.repo}#${issue.number}`
        );
      } else if (ref.merged && !reopened) {
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
