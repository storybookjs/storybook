import { fetchCrossRefs } from '../../../utils/github/cross-refs.ts';
import { wasClosedThenReopened } from '../../../utils/github/timeline.ts';
import type { CheckResult, PrContext } from '../types.ts';

/**
 * Check 3 — Not a duplicate.
 *
 * Purpose: a PR that addresses the same issue as another open or merged PR is
 * not a Minimum Viable Contribution — the maintainer's time is better spent on
 * whichever PR is already further along. This check is the second guardrail
 * (alongside Check 1) that runs before any LLM-judged check, so we can early-
 * abort on definitive structural failures without spending tokens.
 *
 * What we verify, per linked issue:
 *   - An OLDER open PR (lower PR number) cross-referencing the same issue
 *     wins → FAIL. A NEWER open PR doesn't displace this one — the first PR
 *     to be opened for an issue takes precedence.
 *   - Any merged PR that already fixed the issue → FAIL, unless the issue was
 *     subsequently closed-then-reopened (in which case the prior fix didn't
 *     hold and a new attempt is warranted).
 *   - Closed-unmerged PRs and the PR-under-review itself are ignored.
 *
 * Why this shape: we want to fail loudly on duplicate effort but stay silent
 * on dead PRs (closed-unmerged), resurrected work (reopened issues), and
 * later attempts when an earlier PR is already in flight. PR numbers are
 * monotonic per repo so "lower number = older" is a reliable proxy.
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
      const isOlderOpenPr =
        ref.prState === 'open' && !ref.merged && ref.prNumber < pr.number;
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
