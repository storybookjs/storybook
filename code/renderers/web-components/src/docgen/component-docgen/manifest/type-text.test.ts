import { describe, expect, it } from 'vitest';

import { readTypeText } from './type-text.ts';

describe('readTypeText', () => {
  it.each([
    {
      name: 'parsedType present',
      item: { type: { text: 'Size' }, parsedType: { text: "'small' | 'large'" } },
      expected: "'small' | 'large'",
    },
    {
      name: 'parsedType missing',
      item: { type: { text: 'Size' } },
      expected: 'Size',
    },
    {
      name: 'parsedType malformed as string',
      item: { type: { text: 'Size' }, parsedType: "'small' | 'large'" },
      expected: 'Size',
    },
    {
      name: 'parsedType malformed without text',
      item: { type: { text: 'Size' }, parsedType: { value: "'small' | 'large'" } },
      expected: 'Size',
    },
    {
      name: 'parsedType blank',
      item: { type: { text: 'Size' }, parsedType: { text: '' } },
      expected: 'Size',
    },
    {
      name: 'type text malformed',
      item: { type: { text: 5 } },
      expected: undefined,
    },
    {
      name: 'neither',
      item: {},
      expected: undefined,
    },
  ])('$name', ({ item, expected }) => {
    expect(readTypeText(item)).toEqual(expected);
  });
});
