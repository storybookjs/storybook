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
 * PR + linked-issue context that every check consumes. Composed from the
 * github-side `PrSnapshot` plus assess-mvc-specific fields (`linkedIssues`,
 * `brokenLinkRefs`) resolved by `resolveLinkedIssues`.
 */
export interface PrContext extends PrSnapshot {
  linkedIssues: LinkedIssue[];
  brokenLinkRefs: string[];
}

export interface AssessmentResult {
  verdict: Verdict;
  results: CheckResult[];
  earlyAbort: boolean;
  reviewBody: string;
  labelsToAdd: string[];
  labelsToRemove: string[];
}
