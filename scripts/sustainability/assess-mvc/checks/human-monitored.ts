import type { CheckResult } from '../types.ts';

const PASS_LABEL = 'agent-scan:human';
const FAIL_LABELS = new Set(['agent-scan:mixed', 'agent-scan:automated']);

export function checkHumanMonitored(labels: string[]): CheckResult {
  if (labels.includes(PASS_LABEL)) {
    return { id: 'human', status: 'pass', evidence: PASS_LABEL };
  }
  const failHit = labels.find((l) => FAIL_LABELS.has(l));
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
