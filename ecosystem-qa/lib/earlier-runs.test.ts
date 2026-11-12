import { describe, expect, it } from 'vitest';

import { untrustedBecause, type RunOrigin } from './earlier-runs.ts';

const run = (overrides: Partial<RunOrigin> = {}): RunOrigin => ({
  path: '.github/workflows/ecosystem-qa.yml',
  event: 'workflow_dispatch',
  head_branch: 'next',
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
