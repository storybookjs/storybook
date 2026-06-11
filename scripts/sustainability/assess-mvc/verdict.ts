import type { CheckResult, Verdict } from './types.ts';

export function computeVerdict(results: CheckResult[]): Verdict {
  return results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
}

const DETERMINISTIC_IDS: ReadonlyArray<CheckResult['id']> = ['human', 'duplicate'];

export function isEarlyAbort(results: CheckResult[]): boolean {
  return results.some((r) => DETERMINISTIC_IDS.includes(r.id) && r.status === 'fail');
}
