import { describe, expect, it } from 'vitest';

import { computeDiffMetrics } from './diff-metrics.ts';

describe('computeDiffMetrics', () => {
  it('sums additions/deletions and counts files', () => {
    const m = computeDiffMetrics([
      { path: 'a.ts', additions: 10, deletions: 2, status: 'modified' },
      { path: 'b.ts', additions: 5, deletions: 0, status: 'added' },
      { path: 'c.md', additions: 0, deletions: 3, status: 'removed' },
    ]);
    expect(m).toEqual({
      filesChanged: 3,
      added: 15,
      removed: 5,
      net: 10,
      files: ['a.ts', 'b.ts', 'c.md'],
    });
  });

  it('returns zeros for empty diff', () => {
    expect(computeDiffMetrics([])).toEqual({
      filesChanged: 0,
      added: 0,
      removed: 0,
      net: 0,
      files: [],
    });
  });
});
