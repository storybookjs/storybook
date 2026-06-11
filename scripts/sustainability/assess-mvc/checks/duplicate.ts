import { fetchCrossRefs } from '../../../utils/github/cross-refs.ts';
import type { GithubClient } from '../../../utils/github/client.ts';
import { fetchIssueTimeline, type TimelineEvent } from '../../../utils/github/timeline.ts';
import type { CheckResult, PrContext } from '../types.ts';

export interface DuplicateOpts {
  client: GithubClient;
}

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
 *   - Any OTHER open PR cross-referencing the same issue → FAIL.
 *   - Any merged PR that already fixed the issue → FAIL, unless the issue was
 *     subsequently closed-then-reopened (in which case the prior fix didn't
 *     hold and a new attempt is warranted).
 *   - Closed-unmerged PRs and the PR-under-review itself are ignored.
 *
 * Why this shape: we want to fail loudly on duplicate effort but stay silent
 * on dead PRs (closed-unmerged) and resurrected work (reopened issues). The
 * memoized cross-ref/timeline utilities cache per (client, issue), so multi-
 * issue PRs only pay one network round-trip per issue per run.
 */
export async function checkDuplicate(
  pr: Pick<PrContext, 'number' | 'linkedIssues'>,
  opts: DuplicateOpts
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
    const [crossRefs, timeline] = await Promise.all([
      fetchCrossRefs(opts.client, issue),
      fetchIssueTimeline(opts.client, issue),
    ]);
    const wasReopened = isClosedThenReopened(timeline);
    for (const ref of crossRefs) {
      if (ref.prNumber === pr.number) continue;
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
