import type { CheckResult, PrContext } from '../types.ts';

const PASS_LABEL = 'agent-scan:human';
const WARN_LABEL = 'agent-scan:ignore';
const FAIL_LABELS = new Set(['agent-scan:mixed', 'agent-scan:automated']);

/**
 * Human-monitored.
 *
 * Purpose: MVC review is reserved for contributions where a human author is in
 * the loop. The agent-scan classifier labels every PR; this check turns those
 * labels into a verdict. A maintainer override (`ignore`) lets us accept PRs
 * from automated accounts that are confirmed to be driven by a human in real
 * time.
 *
 * What we verify (purely from PR labels, no I/O):
 *   - `agent-scan:human`                → PASS
 *   - `agent-scan:ignore` → WARN (maintainer-applied; an agent
 *     account verified to be remotely controlled by a human)
 *   - `agent-scan:mixed` /
 *     `agent-scan:automated`            → FAIL
 *   - no `agent-scan:*` label yet       → DEFERRED (caller exits 0, no labels,
 *                                          no review; CI retries later)
 *
 * Priority: PASS beats WARN beats FAIL beats DEFERRED. If a maintainer has
 * applied `ignore` on a PR also labeled `automated`, the
 * maintainer's override wins (WARN, not FAIL).
 *
 * Why deterministic: this is the cheapest possible gate and the most
 * confidently structural — if a PR is automated and no human override exists,
 * no amount of LLM judgement changes the answer. Failing here lets us skip
 * the LLM phase entirely.
 */
export function checkHumanMonitored(pr: Pick<PrContext, 'labels'>): CheckResult {
  if (pr.labels.includes(PASS_LABEL)) {
    return { id: 'human', status: 'pass', evidence: PASS_LABEL };
  }
  if (pr.labels.includes(WARN_LABEL)) {
    return {
      id: 'human',
      status: 'warn',
      evidence: `Labeled ${WARN_LABEL}.`,
      guidance:
        'This account is automated but a maintainer has confirmed it is operated by a human in real time. Proceeding with caution.',
    };
  }
  const failHit = pr.labels.find((l) => FAIL_LABELS.has(l));
  if (failHit) {
    return {
      id: 'human',
      status: 'fail',
      evidence: `Labeled ${failHit}.`,
      guidance:
        'Your account was classified as automated. If you think that is a mistake, please report an issue to https://github.com/MatteoGabriele/agentscan. If you are an agent, please ask your human operator to talk to the Storybook team on https://discord.gg/invite/storybook.',
    };
  }
  return {
    id: 'human',
    status: 'deferred',
    evidence: 'No agent-scan:* label yet; deferring until scan runs.',
  };
}
