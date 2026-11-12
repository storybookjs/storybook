import { describe, expect, it } from 'vitest';

import { oldestFirst, untrustedBecause, uploadedAt, type RunOrigin } from './earlier-runs.ts';

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

describe('oldestFirst', () => {
  const first = { id: '2', uploadedAt: '2026-11-12T12:00:00Z' };
  const last = { id: '1', uploadedAt: '2026-11-12T13:00:00Z' };

  it.each([[[first, last]], [[last, first]]])(
    'puts the result that was uploaded last at the end, whatever the order given',
    (results) => {
      expect(oldestFirst(results).map(({ id }) => id)).toEqual(['2', '1']);
    }
  );
});

describe('uploadedAt', () => {
  const listing = {
    artifacts: [
      { name: 'qa-result-linux-claude', created_at: '2026-11-12T12:16:15Z' },
      { name: 'qa-result-linux-claude', created_at: '2026-11-13T09:00:00Z' },
      { name: 'qa-proposals', created_at: '2026-11-14T00:00:00Z' },
    ],
  };

  it('takes the newest artifact of that name, which is the one a rerun of the job uploaded', () => {
    expect(uploadedAt(listing, 'qa-result-linux-claude')).toBe('2026-11-13T09:00:00Z');
  });

  it('knows no time for an artifact the run does not list', () => {
    expect(uploadedAt(listing, 'qa-result-windows-claude')).toBeUndefined();
  });
});
