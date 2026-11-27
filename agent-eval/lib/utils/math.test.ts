import { describe, expect, it } from 'vitest';

import { finiteNumbers, mean, round, share, sum } from './math.ts';

describe('mean', () => {
  it('averages the values', () => {
    expect(mean([10, 20, 30])).toBe(20);
  });

  // 0 would read as a real measured zero rather than "nothing was measured".
  it('is null for no samples, not zero', () => {
    expect(mean([])).toBeNull();
  });

  it('does not round on its own', () => {
    expect(mean([1, 2])).toBe(1.5);
    expect(mean([1, 1, 2])).toBeCloseTo(1.3333, 4);
  });
});

describe('sum', () => {
  it('adds the values', () => {
    expect(sum([1.5, 2.25])).toBe(3.75);
  });

  // An unpriced model reporting 0 would look like a free one.
  it('is null for no samples, not zero', () => {
    expect(sum([])).toBeNull();
  });
});

describe('round', () => {
  it('rounds to two digits by default', () => {
    expect(round(431.5549)).toBe(431.55);
  });

  it('takes a digit count', () => {
    expect(round(0.8333, 3)).toBe(0.833);
  });

  // So it can be chained straight onto mean without a null check at each site.
  it('passes null through', () => {
    expect(round(null)).toBeNull();
  });

  // Math.round alone breaks ties toward +Infinity, which would round -0.125 to
  // -0.12 while rounding 0.125 to 0.13 — flattering a run that simplified code.
  it('rounds negatives and positives alike at a tie', () => {
    expect(round(0.125)).toBe(0.13);
    expect(round(-0.125)).toBe(-0.13);
  });

  it('leaves a value that needs no rounding alone', () => {
    expect(round(-2.5)).toBe(-2.5);
    expect(round(0)).toBe(0);
  });
});

describe('finiteNumbers', () => {
  it('keeps only finite numbers', () => {
    expect(finiteNumbers([1, '2', null, undefined, 3, {}])).toEqual([1, 3]);
  });

  // A stored Infinity or NaN would poison every later mean.
  it('drops NaN and Infinity', () => {
    expect(finiteNumbers([Number.NaN, Number.POSITIVE_INFINITY, -Infinity, 4])).toEqual([4]);
  });
});

describe('share', () => {
  it('returns the share of numerator over denominator', () => {
    expect(share(1, 4)).toBe(0.25);
    expect(share(1, 3)).toBeCloseTo(0.3333, 4);
  });

  it('returns null for a zero denominator', () => {
    expect(share(1, 0)).toBeNull();
  });
});
