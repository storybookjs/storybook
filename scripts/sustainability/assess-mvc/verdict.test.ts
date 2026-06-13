import { describe, expect, it } from 'vitest';

import type { CheckResult } from './types.ts';
import { computeVerdict, isEarlyAbort } from './verdict.ts';

const r = (id: CheckResult['id'], status: CheckResult['status']): CheckResult => ({
  id,
  status,
  evidence: '',
});

describe('computeVerdict', () => {
  it('FAIL when any check fails', () => {
    expect(computeVerdict([r('human', 'pass'), r('duplicate', 'fail')])).toBe('fail');
  });
  it('PASS when all are pass/warn/deferred', () => {
    expect(
      computeVerdict([r('human', 'pass'), r('cost-benefit', 'warn'), r('real-problem', 'deferred')])
    ).toBe('pass');
  });
});

describe('isEarlyAbort', () => {
  it('true if any deterministic check failed', () => {
    expect(isEarlyAbort([r('human', 'fail'), r('duplicate', 'pass')])).toBe(true);
    expect(isEarlyAbort([r('human', 'pass'), r('duplicate', 'fail')])).toBe(true);
  });
  it('false otherwise', () => {
    expect(isEarlyAbort([r('human', 'pass'), r('duplicate', 'pass')])).toBe(false);
    expect(isEarlyAbort([r('human', 'deferred'), r('duplicate', 'pass')])).toBe(false);
  });
});
