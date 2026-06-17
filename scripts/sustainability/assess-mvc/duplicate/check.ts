import { fetchCrossRefs } from '../../../utils/github/cross-refs.ts';
import type { CheckResult, PrContext } from '../types.ts';

/**
 * Check 3 — Not a duplicate.
 *
 * Purpose: an MVC contribution should not duplicate work already represented
 * by an existing PR, and shouldn't address a problem that's already been
 * solved. This check is the second deterministic guardrail (alongside Check
 * 1) and runs before the LLM phase, so we can early-abort on definitive
 * structural failures without spending tokens.
 *
 * What we verify, per linked issue:
 *   - The linked issue is OPEN. A closed linked issue means the problem is
 *     already resolved — the author should re-open it (or open a fresh one)
 *     rather than push a new PR against a closed tracker.
 *   - No OLDER open PR (lower PR number) references the same issue. PR
 *     numbers are monotonic per repo, so "lower number = earlier" is a
 *     reliable proxy for "first PR to address this issue". The earlier PR
 *     wins; the newer one should comment on or contribute to it instead.
 *
 * Merged PRs and closed-unmerged PRs that reference the same issue are
 * ignored — a merged fix that didn't hold is captured by the linked issue
 * being re-opened (which makes it eligible again), and closed-unmerged PRs
 * represent abandoned work that shouldn't block a fresh attempt.
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

  const closedIssues = pr.linkedIssues.filter((i) => i.state === 'closed');
  if (closedIssues.length > 0) {
    const list = closedIssues.map((i) => `${i.owner}/${i.repo}#${i.number}`).join(', ');
    return {
      id: 'duplicate',
      status: 'fail',
      evidence: `Linked issue(s) ${list} are already closed — the problem is resolved.`,
      guidance:
        'If this issue regressed, please re-open it (or open a fresh one) and link that.',
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
      evidence: conflicts.join('; '),
      guidance:
        'An older open PR is already addressing this issue. Consider commenting on / contributing to that PR instead.',
    };
  }

  return {
    id: 'duplicate',
    status: 'pass',
    evidence: 'No conflicting open PR found on the linked issue(s).',
  };
}
