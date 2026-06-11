import type { CheckResult, Verdict } from './types.ts';

/**
 * Reduce check results to a binary verdict.
 *
 * Rule: any `fail` → `fail`; otherwise → `pass`. `warn` and `deferred` are
 * intentionally non-blocking so reviewers see warnings in the review body
 * without the PR being labeled `mvc:failed`, and so a deferred Check 1 (no
 * agent-scan label yet) doesn't poison the verdict.
 */
export function computeVerdict(results: CheckResult[]): Verdict {
  return results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
}

const DETERMINISTIC_IDS: ReadonlyArray<CheckResult['id']> = ['human', 'duplicate'];

/**
 * Was the LLM phase gated by a deterministic FAIL?
 *
 * When true, the LLM checks are stubbed to `deferred` (we don't spend tokens
 * on a PR that has a definitive structural blocker) and the review body
 * explicitly enumerates which LLM checks were not performed.
 */
export function isEarlyAbort(results: CheckResult[]): boolean {
  return results.some((r) => DETERMINISTIC_IDS.includes(r.id) && r.status === 'fail');
}
