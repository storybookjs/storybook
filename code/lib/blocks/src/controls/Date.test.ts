// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { parseDate, parseTime, formatDate, formatTime } from './Date';

describe('Date control', () => {
  it.each([
    // name, input, expected
    ['same date', '2022-01-01', '2022-01-01'],
    ['month and day not padded with zeros', '2022-1-1', '2022-01-01'],
    ['different year', '1900-10-1', '1900-10-01'],
  ])('parse and format date: %s', (name, input, expected) => {
    expect(formatDate(parseDate(input))).toBe(expected);
  });

  it.each([
    // name, input, expected
    ['same time', '12:00', '12:00'],
    ['hours not padded with a zero', '1:00', '01:00'],
    ['minutes not padded with a zero', '01:0', '01:00'],
    ['different minutes', '01:30', '01:30'],
  ])('parse and format time: %s', (name, input, expected) => {
    expect(formatTime(parseTime(input))).toBe(expected);
  });
});
