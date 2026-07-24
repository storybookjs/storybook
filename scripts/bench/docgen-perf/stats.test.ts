import { describe, expect, it } from 'vitest';

import { leastSquaresSlope, mean, median } from './stats.ts';

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
