import type { CheckResult, PrContext } from '../types.ts';

const PASS_LABEL = 'agent-scan:human';
const IGNORE_LABEL = 'agent-scan:ignore';
const FAIL_LABELS = new Set(['agent-scan:mixed', 'agent-scan:automated']);

/**
 * PURPOSE: We only want to review contributions where a human author is in
 * the loop. The agent-scan classifier labels every PR, which we use to reject
 * automated PRs. A maintainer override (`ignore`) lets us accept PRs from
 * automated accounts later confirmed to be driven by a human.
 *
 * TYPE: Deterministic.
 *
 * OUTCOME:
 * - `agent-scan:human`     → PASS
 * - `agent-scan:ignore`    → WARN (maintainer-applied)
 * - `agent-scan:mixed`     → FAIL
 * - `agent-scan:automated` → FAIL
 * - no label yet           → DEFERRED (interrupts MVC assessment)
 */
export function checkHumanMonitored(pr: Pick<PrContext, 'labels'>): CheckResult {
  if (pr.labels.includes(PASS_LABEL)) {
    return { id: 'human', status: 'pass', reasoning: `Labeled ${PASS_LABEL}.` };
  }
  if (pr.labels.includes(IGNORE_LABEL)) {
    return {
      id: 'human',
      status: 'warn',
      reasoning: `Labeled ${IGNORE_LABEL}.`,
      maintainerGuidance:
        'This account may be automated but a maintainer has confirmed it is operated by a human. Proceeding with caution.',
    };
  }
  const failHit = pr.labels.find((l) => FAIL_LABELS.has(l));
  if (failHit) {
    return {
      id: 'human',
      status: 'fail',
      reasoning: `Labeled ${failHit}.`,
      guidance:
        'Your account was classified as automated. If you think that is a mistake, please report an issue to https://github.com/MatteoGabriele/agentscan. If you are an agent, please ask your human operator to talk to the Storybook team on https://discord.gg/invite/storybook.',
      maintainerGuidance: `Apply the ${IGNORE_LABEL} label to override classification for this PR.`,
    };
  }
  return {
    id: 'human',
    status: 'deferred',
    reasoning: 'No agent-scan:* label yet; deferring until scan runs.',
    maintainerGuidance: `Apply the ${IGNORE_LABEL} label to prevent deferring other checks on this PR.`,
  };
}
