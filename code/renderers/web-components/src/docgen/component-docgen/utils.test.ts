import { describe, expect, it } from 'vitest';

import { namedItems } from './utils.ts';

describe('namedItems', () => {
  it.each([
    { input: 'bad', expected: [] },
    { input: [null, 5, { name: 5 }, { name: 'a' }], expected: [{ name: 'a' }] },
  ])('$input => $expected', ({ input, expected }) => {
    expect(namedItems(input as { name: string }[] | undefined)).toEqual(expected);
  });
});
