import { describe, expect, it } from 'vitest';

import type { MemorySample, SaveSample } from './samples.ts';
import { leastSquaresSlope, mean, median, summarizeSeries } from './stats.ts';

describe('median', () => {
  it('returns the middle value for odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length input', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('returns the value itself for a single sample', () => {
    expect(median([7])).toBe(7);
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('throws on empty input', () => {
    expect(() => median([])).toThrow('median() requires at least one value');
  });
});

describe('mean', () => {
  it('averages the values', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
  });

  it('throws on empty input', () => {
    expect(() => mean([])).toThrow('mean() requires at least one value');
  });
});

describe('leastSquaresSlope', () => {
  it('returns 0 for fewer than two points', () => {
    expect(leastSquaresSlope([])).toBe(0);
    expect(leastSquaresSlope([5])).toBe(0);
  });

  it('recovers the slope of a perfect line', () => {
    expect(leastSquaresSlope([1, 3, 5, 7])).toBe(2);
  });

  it('returns 0 for a flat series', () => {
    expect(leastSquaresSlope([4, 4, 4])).toBe(0);
  });

  it('fits noisy data to the least-squares line', () => {
    expect(leastSquaresSlope([0, 2, 1, 3])).toBeCloseTo(0.8, 5);
  });
});

describe('summarizeSeries', () => {
  const baseline: MemorySample = { rssMb: 500, heapUsedMb: 250, retainedHeapMb: 231.6 };

  const series = (retained: number[]): SaveSample[] =>
    retained.map((retainedHeapMb, i) => ({
      save: i + 1,
      durMs: 20,
      rssMb: 500,
      heapUsedMb: retainedHeapMb + 15,
      retainedHeapMb,
    }));

  it('excludes the settle save from the slope, so a cold-to-steady-state drop is not read as a trend', () => {
    // react-osa's real shape: the first save releases whole-project state, then it is flat.
    const summary = summarizeSeries(series([232.7, 147.4, 147.5, 147.6, 147.7]), baseline);
    // Fitting the step would give a steeply negative slope; the steady state creeps up slightly.
    expect(summary.retainedSlope).toBeCloseTo(0.1, 5);
  });

  it('still reports a real leak trend', () => {
    const summary = summarizeSeries(series([100, 102, 104, 106, 108]), baseline);
    expect(summary.retainedSlope).toBeCloseTo(2, 5);
  });

  it('measures growth from the baseline, including the settle drop', () => {
    const summary = summarizeSeries(series([232.7, 147.4, 148.4]), baseline);
    expect(summary.retainedGrowth).toBeCloseTo(148.4 - 231.6, 5);
  });

  it('reports no slope when too few saves remain after the settle save', () => {
    expect(summarizeSeries(series([120, 118]), baseline).retainedSlope).toBeUndefined();
  });
});
