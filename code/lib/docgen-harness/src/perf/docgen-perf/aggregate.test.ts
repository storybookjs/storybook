import { describe, expect, it } from 'vitest';

import type { MemorySample, SaveSample } from '../docgen-shared/samples.ts';
import type { SeriesResult } from '../docgen-shared/series.ts';
import { summarizeSeries } from '../docgen-shared/stats.ts';
import { designatedRep, oneShotMetrics, seriesMetrics } from './aggregate.ts';

function sample(save: number, durMs: number, heapUsedMb = 20, retainedHeapMb = 10): SaveSample {
  return { save, durMs, rssMb: 100, heapUsedMb, retainedHeapMb };
}

/** Built through summarizeSeries, so the fixture cannot claim figures a real run would not produce. */
function repOf(coldMs: number, samples: SaveSample[], baseline: MemorySample): SeriesResult {
  return { coldMs, baseline, samples, ...summarizeSeries(samples, baseline) };
}

function rep(coldMs: number, durations: number[]): SeriesResult {
  return repOf(
    coldMs,
    durations.map((d, i) => sample(i + 1, d)),
    { rssMb: 90, heapUsedMb: 12, retainedHeapMb: 10 }
  );
}

describe('designatedRep', () => {
  it('picks the repetition whose cold sample is the median', () => {
    const reps = [rep(900, [1]), rep(100, [2]), rep(300, [3]), rep(200, [4]), rep(250, [5])];
    expect(designatedRep(reps).coldMs).toBe(250);
  });

  it('never picks the slow first repetition just because it came first', () => {
    const reps = [rep(5000, [999]), rep(100, [10]), rep(110, [11]), rep(120, [12]), rep(130, [13])];
    expect(designatedRep(reps).coldMs).not.toBe(5000);
    expect(designatedRep(reps).coldMs).toBe(120);
  });

  it('takes the lower middle for an even count', () => {
    const reps = [rep(10, [1]), rep(20, [2]), rep(30, [3]), rep(40, [4])];
    expect(designatedRep(reps).coldMs).toBe(20);
  });

  it('does not mutate its input', () => {
    const reps = [rep(30, [1]), rep(10, [2]), rep(20, [3])];
    designatedRep(reps);
    expect(reps.map((r) => r.coldMs)).toEqual([30, 10, 20]);
  });
});

describe('seriesMetrics', () => {
  const reps = [rep(300, [9, 9, 9]), rep(100, [1, 2, 3]), rep(200, [4, 5, 6])];

  it('medians cold across every repetition', () => {
    expect(seriesMetrics(reps, 3).coldExtractionMs).toMatchObject({
      samples: [300, 100, 200],
      value: 200,
    });
  });

  it('reads warm from the designated repetition, not the first', () => {
    expect(seriesMetrics(reps, 3).warmExtractionMs).toMatchObject({
      samples: [4, 5, 6],
      value: 5,
    });
  });

  it('marks whole-project scan as not applicable rather than faking one', () => {
    expect(seriesMetrics(reps, 3).wholeProjectScanMs).toEqual({ status: 'n/a' });
  });

  it('derives transient memory from the same repetition warm came from', () => {
    expect(seriesMetrics(reps, 3).peakTransientMb).toMatchObject({ value: 10 });
  });

  it('rejects a repetition count below the pinned N', () => {
    expect(() => seriesMetrics(reps, 5)).toThrow('recorded 3 repetitions, expected the pinned 5');
  });

  it('rejects an empty set of repetitions', () => {
    expect(() => seriesMetrics([], 5)).toThrow('no completed repetition recorded');
  });

  it('rejects a run with no retained samples', () => {
    const noGc = repOf(100, [{ save: 1, durMs: 5, rssMb: 100, heapUsedMb: 20 }], {
      rssMb: 90,
      heapUsedMb: 12,
    });
    expect(() => seriesMetrics([noGc], 1)).toThrow('retained metrics missing');
  });
});

describe('oneShotMetrics', () => {
  const reps = [
    { coldMs: 300, warmMs: 280, peakRssMb: 500 },
    { coldMs: 100, warmMs: 120, peakRssMb: 400 },
    { coldMs: 200, warmMs: 200, peakRssMb: 450 },
  ];

  it('reports cold and whole-project scan as the same measurement', () => {
    const metrics = oneShotMetrics(reps, 3);
    expect(metrics.wholeProjectScanMs).toEqual(metrics.coldExtractionMs);
  });

  it('has no retained series to report', () => {
    const metrics = oneShotMetrics(reps, 3);
    expect(metrics.retainedGrowthMb).toEqual({ status: 'n/a' });
    expect(metrics.retainedSlopeMbPerSave).toEqual({ status: 'n/a' });
  });

  it('enforces the pinned repetition count', () => {
    expect(() => oneShotMetrics(reps, 5)).toThrow('expected the pinned 5');
  });

  it('reports no peak rather than a low one when a repetition went unsampled', () => {
    // `ps` is POSIX-only and a short run can finish inside one poll interval, so a repetition can
    // come back with nothing sampled. Averaging that in would report a peak nobody measured.
    const partial = [
      { coldMs: 300, warmMs: 280, peakRssMb: 500 },
      { coldMs: 100, warmMs: 120 },
    ];
    expect(oneShotMetrics(partial, 2).peakTransientMb).toEqual({ status: 'n/a' });
  });
});
