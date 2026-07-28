import { describe, expect, it } from 'vitest';

import { renderRatios, renderResults } from './report.ts';
import { NOT_APPLICABLE, type Ratios } from './types.ts';

describe('renderRatios', () => {
  const notLikeForLike: Ratios = {
    vue: {
      flat: {
        cold: 18.48,
        warm: 22.5,
        legacyColdMembers: 6,
        nextColdMembers: 320,
        legacyWarmMembers: 0,
        nextWarmMembers: 32,
        likeForLike: false,
      },
    },
  };

  it('warns on the cold line when the engines documented different members', () => {
    const [cold] = renderRatios(notLikeForLike);
    expect(cold).toContain('documented members 6 vs 320');
    expect(cold).toContain('NOT like-for-like');
  });

  it('warns on the warm line too', () => {
    // The warm ratio is the more misleading of the two: the legacy Vue parser documented nothing
    // on the save it was timed on, so a bare ratio reads as a 22x speed win over identical work.
    const warm = renderRatios(notLikeForLike).find((line) => line.includes('warm'));
    expect(warm).toContain('documented members 0 vs 32');
    expect(warm).toContain('NOT like-for-like');
  });

  it('prints no warning when the engines did the same work', () => {
    const lines = renderRatios({
      vue: {
        flat: { cold: 1.2, warm: 1.1, legacyColdMembers: 50, nextColdMembers: 50, likeForLike: true },
      },
    });
    expect(lines.every((line) => !line.includes('NOT like-for-like'))).toBe(true);
    expect(lines[0]).toContain('documented members 50 vs 50');
  });

  it('prints a bare ratio when neither engine reports member counts', () => {
    const lines = renderRatios({ react: { default: { cold: 4, warm: 2 } } });
    expect(lines).toEqual([
      '  ratio cold legacy/new (react/default): 4.00',
      '  ratio warm legacy/new (react/default): 2.00',
    ]);
  });

  it('says so when there is no ratio at all', () => {
    expect(renderRatios({})).toEqual([
      '  no calibration ratio: it needs both sides of a control pair measured in one run',
    ]);
  });

  it('omits a half of the pair that did not measure', () => {
    const lines = renderRatios({ react: { default: { cold: 4 } } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('cold');
  });
});

describe('renderResults', () => {
  it('lists a failed engine as a status line rather than a table row', () => {
    const { table, statusLines } = renderResults(['compodoc'], {
      compodoc: { status: 'failed', reason: 'child exited with status 1:\nsecond line' },
    });
    expect(table).toHaveLength(1); // header only
    expect(statusLines).toEqual(['  compodoc: FAILED - child exited with status 1:']);
  });

  it('renders n/a metrics as n/a rather than zero', () => {
    const { table } = renderResults(['react-osa'], {
      'react-osa': {
        status: 'measured',
        scenarios: {
          default: {
            params: {},
            metrics: {
              coldExtractionMs: { status: 'measured', samples: [100], median: 100 },
              warmExtractionMs: { status: 'measured', samples: [10], median: 10 },
              wholeProjectScanMs: NOT_APPLICABLE,
              peakTransientMb: { status: 'measured', samples: [5], mean: 5 },
              retainedGrowthMb: { status: 'measured', value: 3 },
              retainedSlopeMbPerSave: { status: 'measured', value: 0.25 },
            },
          },
        },
      },
    });
    expect(table[1]).toContain('n/a');
    expect(table[1]).toContain('0.25MB/save');
  });
});
