import { describe, expect, it } from 'vitest';

import { DEFAULT_TYPE_PROPERTY, readTypeText } from './alt-type.ts';

describe('readTypeText', () => {
  it.each([
    {
      name: 'alt present',
      item: { type: { text: 'Size' }, parsedType: { text: "'small' | 'large'" } },
      typeProperty: DEFAULT_TYPE_PROPERTY,
      expected: "'small' | 'large'",
    },
    {
      name: 'alt missing',
      item: { type: { text: 'Size' } },
      typeProperty: DEFAULT_TYPE_PROPERTY,
      expected: 'Size',
    },
    {
      name: 'alt malformed as string',
      item: { type: { text: 'Size' }, parsedType: "'small' | 'large'" },
      typeProperty: DEFAULT_TYPE_PROPERTY,
      expected: 'Size',
    },
    {
      name: 'alt malformed without text',
      item: { type: { text: 'Size' }, parsedType: { value: "'small' | 'large'" } },
      typeProperty: DEFAULT_TYPE_PROPERTY,
      expected: 'Size',
    },
    {
      name: 'neither',
      item: {},
      typeProperty: DEFAULT_TYPE_PROPERTY,
      expected: undefined,
    },
    {
      name: 'custom property name',
      item: { type: { text: 'Size' }, resolvedType: { text: "'small' | 'large'" } },
      typeProperty: 'resolvedType',
      expected: "'small' | 'large'",
    },
  ])('$name', ({ item, typeProperty, expected }) => {
    expect(readTypeText(item, typeProperty)).toEqual(expected);
  });
});
