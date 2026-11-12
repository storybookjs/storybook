import { describe, expect, it } from 'vitest';

import { oldestFirst, untrustedBecause, type RunOrigin } from './earlier-runs.ts';

const run = (overrides: Partial<RunOrigin> = {}): RunOrigin => ({
  path: '.github/workflows/ecosystem-qa.yml',
  event: 'workflow_dispatch',
  head_branch: 'next',
  run_started_at: '2026-11-12T12:00:00Z',
  ...overrides,
});
const BRANCHES = ['next', 'valentin/collecting'];

describe('untrustedBecause', () => {
  it.each(BRANCHES)('trusts a run of this workflow started by hand on %s', (head_branch) => {
    expect(untrustedBecause(run({ head_branch }), BRANCHES)).toBeUndefined();
  });

  it('rejects a run of another workflow', () => {
    expect(untrustedBecause(run({ path: '.github/workflows/nx.yml' }), BRANCHES)).toBe(
      'is a run of .github/workflows/nx.yml, not of .github/workflows/ecosystem-qa.yml'
    );
  });

  it('rejects the run of a pull request, which a fork can open', () => {
    expect(untrustedBecause(run({ event: 'pull_request' }), BRANCHES)).toBe(
      'was started by a pull_request event, not by hand'
    );
  });

  it('rejects a run on a branch that is neither the default nor the collecting one', () => {
    expect(untrustedBecause(run({ head_branch: 'someone/else' }), BRANCHES)).toBe(
      'ran on someone/else, not on next or valentin/collecting'
    );
    expect(untrustedBecause(run({ head_branch: null }), BRANCHES)).toMatch(/^ran on no branch/);
  });
});

describe('oldestFirst', () => {
  // The run with the lower id started later, as a run does that was started again.
  const startedFirst = { id: '2', ...run({ run_started_at: '2026-11-12T12:00:00Z' }) };
  const startedLast = { id: '1', ...run({ run_started_at: '2026-11-12T13:00:00Z' }) };

  it.each([[[startedFirst, startedLast]], [[startedLast, startedFirst]]])(
    'puts the run that started last at the end, whatever the order given',
    (runs) => {
      expect(oldestFirst(runs).map(({ id }) => id)).toEqual(['2', '1']);
    }
  );
});
