import { describe, expect, it } from 'vitest';

import { deriveVerdict } from './derive-verdict.ts';

describe('deriveVerdict', () => {
  it('downgrades verified → regression when unit tests failed', () => {
    const input = {
      verdict: 'verified',
      template: 'internal-ui',
      unitTests: { ran: true, passed: false, summary: '0 passed, 1 failed' },
    };
    const { outcome, result } = deriveVerdict(input, null);
    expect(outcome.verdict).toBe('regression');
    expect(outcome.changed).toBe(true);
    expect(result?.verdict).toBe('regression');
    expect(result?.regressionReason).toMatch(/unit tests failed/);
  });

  it('leaves verified verdict alone when unit tests pass', () => {
    const input = {
      verdict: 'verified',
      template: 'internal-ui',
      unitTests: { ran: true, passed: true, summary: '3 passed, 0 failed' },
    };
    const { outcome, result } = deriveVerdict(input, null);
    expect(outcome.verdict).toBe('verified');
    expect(outcome.changed).toBe(false);
    expect(result?.regressionReason).toBeUndefined();
  });

  it('leaves verified verdict alone when unit tests did not run', () => {
    const input = {
      verdict: 'verified',
      template: 'internal-ui',
      unitTests: { ran: false, passed: null as boolean | null, summary: 'no PR-added test files in diff' },
    };
    const { outcome } = deriveVerdict(input, null);
    expect(outcome.verdict).toBe('verified');
    expect(outcome.changed).toBe(false);
  });

  it('derives regressionReason from playwright report when missing', () => {
    const input = { verdict: 'regression', template: 'internal-ui' };
    const report = {
      suites: [
        {
          specs: [
            {
              title: 'renders Button',
              tests: [
                {
                  results: [
                    {
                      errors: [{ message: 'expect(locator).toBeVisible() failed' }],
                    },
                  ],
                  errors: [{ message: 'expect(locator).toBeVisible() failed' }],
                  title: 'renders Button',
                },
              ],
            },
          ],
        },
      ],
    };
    const { outcome } = deriveVerdict(input, report);
    expect(outcome.verdict).toBe('regression');
    expect(outcome.changed).toBe(true);
    expect(outcome.regressionReason).toMatch(/Playwright assertion failed/);
  });

  it('returns verdict=missing when result is null', () => {
    const { outcome } = deriveVerdict(null, null);
    expect(outcome.verdict).toBe('missing');
    expect(outcome.changed).toBe(false);
  });

  it('does not overwrite existing regressionReason', () => {
    const input = {
      verdict: 'regression',
      template: 'internal-ui',
      regressionReason: 'compile failure (see regressionDetails)',
    };
    const report = { suites: [{ errors: [{ message: 'should not be used' }] }] };
    const { outcome } = deriveVerdict(input, report);
    expect(outcome.regressionReason).toBe('compile failure (see regressionDetails)');
    expect(outcome.changed).toBe(false);
  });
});
