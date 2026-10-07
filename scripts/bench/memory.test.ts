import { describe, expect, it } from 'vitest';

import { processTree, summarizePhase, type MemorySample } from './memory.ts';

describe('processTree', () => {
  it('includes all descendants without including sibling processes', () => {
    expect(
      processTree(
        [
          { pid: 1, parentPid: 0, rssBytes: 1 },
          { pid: 2, parentPid: 1, rssBytes: 2 },
          { pid: 3, parentPid: 2, rssBytes: 3 },
          { pid: 4, parentPid: 1, rssBytes: 4 },
        ],
        2
      ).map(({ pid }) => pid)
    ).toEqual([2, 3]);
  });
});

describe('summarizePhase', () => {
  it('reports HMR peak, settled memory, and growth', () => {
    const samples: MemorySample[] = [
      { elapsedMs: 0, phase: 'devHmr', processTreeRssBytes: 10 * 1024 * 1024, processes: [] },
      { elapsedMs: 1, phase: 'devHmr', processTreeRssBytes: 16 * 1024 * 1024, processes: [] },
    ];
    expect(summarizePhase(samples, 'devHmr')).toEqual({
      peakProcessTreeRssMb: 16,
      settledProcessTreeRssMb: 16,
      growthMb: 6,
      slopeMbPerEdit: 6,
      sampleCount: 2,
    });
  });
});
