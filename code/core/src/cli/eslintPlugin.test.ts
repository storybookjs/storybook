import { describe, expect, it } from 'vitest';

import { normalizeExtends } from './eslintPlugin';

describe('normalizeExtends', () => {
  it('returns empty array when existingExtends is falsy', () => {
    expect(normalizeExtends(null)).toEqual([]);
    expect(normalizeExtends(undefined)).toEqual([]);
  });

  it('returns existingExtends when it is a string', () => {
    expect(normalizeExtends('foo')).toEqual(['foo']);
  });

  it('returns existingExtends when it is an array', () => {
    expect(normalizeExtends(['foo'])).toEqual(['foo']);
  });

  it('throws when existingExtends is not a string or array', () => {
    expect(() => normalizeExtends(true)).toThrowError('Invalid eslint extends true');
  });
});
