import type { CheckResult, PrContext } from '../types.ts';

const PASS_LABEL = 'agent-scan:human';
const FAIL_LABELS = new Set(['agent-scan:mixed', 'agent-scan:automated']);

/**
 * Check 1 — Human-monitored.
 *
 * Purpose: MVC review is reserved for contributions where a human author is in
 * the loop. Fully or partially automated PRs are rejected; PRs without an
 * agent-scan classification are deferred (defer ≠ fail — the agent-scan
 * workflow may simply not have run yet, and CI will retry on `labeled` or
 * `synchronize` events once it does).
 *
 * What we verify (purely from PR labels, no I/O):
 *   - `agent-scan:human`           → PASS
 *   - `agent-scan:mixed` /
 *     `agent-scan:automated`       → FAIL
 *   - no `agent-scan:*` label yet  → DEFERRED (caller exits 0, no labels,
 *                                    no review; CI retries later)
 *
 * Why deterministic: this is the cheapest possible gate and the most
 * confidently structural — if a PR is automated, no amount of LLM judgement
 * changes the answer. Failing here lets us skip the LLM phase entirely.
 */
export function checkHumanMonitored(pr: Pick<PrContext, 'labels'>): CheckResult {
  if (pr.labels.includes(PASS_LABEL)) {
    return { id: 'human', status: 'pass', evidence: PASS_LABEL };
  }
  const failHit = pr.labels.find((l) => FAIL_LABELS.has(l));
  if (failHit) {
    return {
      id: 'human',
      status: 'fail',
      evidence: `Labeled ${failHit}; this assessment is reserved for human-authored contributions.`,
      guidance:
        'This PR is flagged as authored or co-authored by an automated agent. We only accept PRs from human contributors.',
    };
  }
  return {
    id: 'human',
    status: 'deferred',
    evidence: 'No agent-scan:* label yet; deferring until scan runs.',
  };
}
