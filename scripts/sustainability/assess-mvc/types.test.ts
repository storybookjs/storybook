import { describe, it, expectTypeOf } from 'vitest';

import type { AssessmentResult, CheckId, CheckResult, CheckStatus, Verdict } from './types.ts';

describe('types', () => {
  it('exposes the six check ids', () => {
    expectTypeOf<CheckId>().toEqualTypeOf<
      'human' | 'real-problem' | 'duplicate' | 'cost-benefit' | 'explains-test' | 'provides-context'
    >();
  });

  it('exposes the four check statuses', () => {
    expectTypeOf<CheckStatus>().toEqualTypeOf<'pass' | 'fail' | 'warn' | 'deferred'>();
  });

  it('requires id/status/reasoning on CheckResult, allows optional guidance', () => {
    expectTypeOf<CheckResult>().toMatchTypeOf<{
      id: CheckId;
      status: CheckStatus;
      reasoning: string;
    }>();
    expectTypeOf<CheckResult['guidance']>().toEqualTypeOf<string | undefined>();
  });

  it('exposes a binary Verdict', () => {
    expectTypeOf<Verdict>().toEqualTypeOf<'pass' | 'fail'>();
  });

  it('AssessmentResult bundles verdict, results, and early-abort info', () => {
    expectTypeOf<AssessmentResult>().toMatchTypeOf<{
      verdict: Verdict;
      results: CheckResult[];
      earlyAbort: boolean;
    }>();
  });
});
