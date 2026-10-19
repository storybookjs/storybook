import { describe, expect, it } from 'vitest';

import { deepMerge } from './deep-merge.ts';

describe('deepMerge', () => {
  it('merges nested objects recursively', () => {
    expect(deepMerge({ nested: { a: 1 } }, { nested: { b: 2 } })).toEqual({
      nested: { a: 1, b: 2 },
    });
  });

  it('replaces arrays instead of concatenating them', () => {
    expect(deepMerge({ styles: ['a.scss'] }, { styles: ['b.scss', 'c.scss'] })).toEqual({
      styles: ['b.scss', 'c.scss'],
    });
  });

  it('skips null source values', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: null, b: 3 })).toEqual({ a: 1, b: 3 });
  });
});
