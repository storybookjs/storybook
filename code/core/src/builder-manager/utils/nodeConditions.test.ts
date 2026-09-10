import { expect, it } from 'vitest';

import { parseConditionsFromArgs } from './nodeConditions.ts';

it('returns an empty array when no conditions flags are present', () => {
  expect(parseConditionsFromArgs([])).toEqual([]);
});

it('reads the value following --conditions', () => {
  expect(parseConditionsFromArgs(['--conditions', '@app/src'])).toEqual(['@app/src']);
});

it('reads the value following -C', () => {
  expect(parseConditionsFromArgs(['-C', '@app/src'])).toEqual(['@app/src']);
});

it('ignores unrelated flags', () => {
  expect(parseConditionsFromArgs(['--max-old-space-size', '4096'])).toEqual([]);
});

it('collects repeated flags in first-seen order', () => {
  expect(parseConditionsFromArgs(['--conditions', 'first', '-C', 'second'])).toEqual([
    'first',
    'second',
  ]);
});

it('dedupes repeated condition values', () => {
  expect(parseConditionsFromArgs(['--conditions', '@app/src', '-C', '@app/src'])).toEqual([
    '@app/src',
  ]);
});

it('ignores a trailing flag with no following value', () => {
  expect(parseConditionsFromArgs(['--conditions'])).toEqual([]);
});
