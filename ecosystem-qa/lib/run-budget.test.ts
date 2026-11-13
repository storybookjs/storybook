import { describe, expect, it } from 'vitest';

import { DEFAULT_BUDGET, msUntilHardStop, parseBudget } from './run-budget.ts';

describe('parseBudget', () => {
  it('is 90 minutes with a hard stop at 105 when nothing is given', () => {
    expect(parseBudget()).toEqual({ minutes: 90, hardStopMinutes: 105 });
  });

  it('takes both values, also parts of a minute', () => {
    expect(parseBudget('0.5', '2')).toEqual({ minutes: 0.5, hardStopMinutes: 2 });
  });

  it('keeps the default hard stop when only the budget is given', () => {
    expect(parseBudget('60')).toEqual({ minutes: 60, hardStopMinutes: 105 });
  });

  it.each([
    ['90', '90'],
    ['90', '60'],
    ['120', undefined],
  ])('refuses a hard stop that is not after the budget (%s, %s)', (minutes, hardStop) => {
    expect(parseBudget(minutes, hardStop)).toMatch(/has to come after the budget/);
  });

  it.each([
    ['0', '10'],
    ['-5', '10'],
    ['soon', '10'],
    ['10', 'later'],
  ])('refuses %j and %j as minutes', (minutes, hardStop) => {
    expect(parseBudget(minutes, hardStop)).toMatch(/take a number of minutes above zero/);
  });
});

describe('msUntilHardStop', () => {
  const startedAt = new Date('2026-11-13T10:00:00Z');

  it('counts from the start of the run', () => {
    const now = new Date('2026-11-13T10:30:00Z');

    expect(msUntilHardStop(startedAt, DEFAULT_BUDGET, now)).toBe(75 * 60_000);
  });

  it('is zero, not negative, once the hard stop has passed', () => {
    const now = new Date('2026-11-13T12:00:00Z');

    expect(msUntilHardStop(startedAt, DEFAULT_BUDGET, now)).toBe(0);
  });
});
