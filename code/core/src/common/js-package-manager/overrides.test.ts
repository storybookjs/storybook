import { describe, expect, it } from 'vitest';

import { toOverrides } from './overrides.ts';

describe('toOverrides', () => {
  it.each([
    { name: 'a non-object field', input: 'storybook@10', expected: undefined },
    { name: 'an array field', input: ['storybook'], expected: undefined },
    {
      name: 'ranges and nested scopes',
      input: { storybook: '~10.5.3', a: { '.': '1.0.0', b: '2.0.0' } },
      expected: { storybook: '~10.5.3', a: { '.': '1.0.0', b: '2.0.0' } },
    },
    { name: 'a bare numeric pin', input: { storybook: 10 }, expected: { storybook: '10' } },
    {
      name: 'entries that are neither ranges nor scopes',
      input: { a: true, b: ['1'], c: null, d: '1.0.0' },
      expected: { d: '1.0.0' },
    },
  ])('$name', ({ input, expected }) => {
    expect(toOverrides(input)).toEqual(expected);
  });
});
