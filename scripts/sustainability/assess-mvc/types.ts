import z from 'zod';
import type { Issue } from '../../utils/github/issue.ts';
import type { PrWithFiles } from '../../utils/github/pr.ts';

export type { Issue, PrWithFiles as PrSnapshot };

export type CheckId =
  | 'human'
  | 'real-problem'
  | 'duplicate'
  | 'cost-benefit'
  | 'explains-test'
  | 'provides-context';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'deferred';

export type Verdict = 'pass' | 'fail';

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  reasoning: string;
  guidance?: string;
  maintainerGuidance?: string;
}

export const CheckResultSchema = z.object({
  status: z.enum(['pass', 'fail', 'warn', 'deferred']),
  reasoning: z.string(),
  guidance: z.string().optional(),
  maintainerGuidance: z.string().optional(),
});

/**
 * PR + linked-references context that every check consumes. Composed from
 * the github-side `PrSnapshot` plus the buckets from `resolveLinkedIssues`:
 *
 *   - `linkedIssues` — strongest signal (GitHub's `closingIssuesReferences`).
 *   - `otherIssues` — body-found refs that resolve to real issues but aren't
 *     in the API list.
 *   - `unresolved` — body-found numbers that aren't issues (could be PRs
 *     or typos). Debug info; doesn't affect the run.
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
