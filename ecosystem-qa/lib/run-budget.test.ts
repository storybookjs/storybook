import { describe, expect, it } from 'vitest';

import { msUntilHardStop, parseBudget } from './run-budget.ts';

describe('parseBudget', () => {
  it('is 90 minutes with a hard stop at 105 when nothing is given', () => {
    expect(parseBudget()).toEqual({ minutes: 90, hardStopMinutes: 105 });
  });

  it('takes both values, also parts of a minute', () => {
    expect(parseBudget('0.5', '2')).toEqual({ minutes: 0.5, hardStopMinutes: 2 });
  });

  it('puts the hard stop 15 minutes after a budget that is given alone', () => {
    expect(parseBudget('5')).toEqual({ minutes: 5, hardStopMinutes: 20 });
    expect(parseBudget('150')).toEqual({ minutes: 150, hardStopMinutes: 165 });
  });

  it.each([
    ['90', '90'],
    ['90', '60'],
  ])('refuses a hard stop that is not after the budget (%s, %s)', (minutes, hardStop) => {
    expect(parseBudget(minutes, hardStop)).toMatch(/has to come after the budget/);
  });

  it.each([
    ['0', '10'],
    ['-5', '10'],
    ['soon', '10'],
    ['10', 'later'],
    ['Infinity', undefined],
  ])('refuses %j and %j as minutes', (minutes, hardStop) => {
    expect(parseBudget(minutes, hardStop)).toMatch(/take a number of minutes above zero/);
  });
});

describe('msUntilHardStop', () => {
  const startedAt = new Date('2026-11-13T10:00:00Z');
  const budget = { minutes: 90, hardStopMinutes: 105 };

  it('counts from the start of the run', () => {
    const now = new Date('2026-11-13T10:30:00Z');

    expect(msUntilHardStop(startedAt, budget, now)).toBe(75 * 60_000);
  });

  it('is zero, not negative, once the hard stop has passed', () => {
    const now = new Date('2026-11-13T12:00:00Z');

    expect(msUntilHardStop(startedAt, budget, now)).toBe(0);
  });

  it('is a whole number of milliseconds for a hard stop at a part of a minute', () => {
    const left = msUntilHardStop(startedAt, { minutes: 1, hardStopMinutes: 100.123456 }, startedAt);

    expect(Number.isInteger(left)).toBe(true);
    expect(() => AbortSignal.timeout(left)).not.toThrow();
  });
});
