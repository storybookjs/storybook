import type { LinkedIssue } from '../../utils/github/linked-issues.ts';
import type { PrSnapshot } from '../../utils/github/pr.ts';

export type { LinkedIssue, PrSnapshot };

export type CheckId =
  | 'human'
  | 'real-problem'
  | 'duplicate'
  | 'cost-benefit'
  | 'explains-test'
  | 'provides-context';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'deferred';

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  evidence: string;
  guidance?: string;
}

export type Verdict = 'pass' | 'fail';

/**
 * PR + linked-references context that every check consumes. Composed from
 * the github-side `PrSnapshot` plus the four-bucket result of
 * `resolveLinkedIssues`:
 *
 *   - `linkedIssues` — strongest signal (GitHub's `closingIssuesReferences`).
 *   - `otherIssues` — body-found refs that resolve to real issues but aren't
 *     in the API list.
 *   - `otherPrs` — body-found refs that turn out to be other PRs (mentions
 *     for context; never drive the duplicate / real-problem checks).
 *   - `unresolved` — body-found numbers that don't exist as either issue
 *     or PR. Debug info; doesn't fail the run.
 */
export interface PrContext extends PrSnapshot {
  linkedIssues: LinkedIssue[];
  otherIssues: LinkedIssue[];
  otherPrs: LinkedIssue[];
  unresolved: string[];
}

export interface AssessmentResult {
  verdict: Verdict;
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
}
