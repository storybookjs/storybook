import { describe, expect, it } from 'vitest';

import { normalizeBase } from './base.ts';

describe('normalizeBase', () => {
  it.each([
    { input: undefined, expected: '/__storybook' },
    { input: '/x', expected: '/x' },
    { input: 'x', expected: '/x' },
    { input: '/x/', expected: '/x' },
    { input: '  /x  ', expected: '/x' },
    { input: '/', expected: '/' },
    { input: '', expected: '/' },
  ])('normalizes $input to $expected', ({ input, expected }) => {
    expect(normalizeBase(input)).toBe(expected);
  });
});
