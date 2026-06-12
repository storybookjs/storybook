import type { Issue } from '../../utils/github/issue.ts';
import type { LinkedIssue } from '../../utils/github/linked-issues.ts';
import type { PrWithFiles } from '../../utils/github/pr.ts';

export type { LinkedIssue, PrWithFiles as PrSnapshot };

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
 *   - `unresolved` — body-found numbers that aren't issues (could be PRs)
 *     Debug info; doesn't affect the run.
 */
export interface PrContext extends PrWithFiles {
  linkedIssues: Issue[];
  otherIssues: Issue[];
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
