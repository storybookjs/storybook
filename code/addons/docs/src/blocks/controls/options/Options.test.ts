import { describe, expect, it } from 'vitest';

import { normalizeOptions } from './Options';

describe('normalizeOptions', () => {
  it('uses String(item) as label when no labels map is provided', () => {
    expect(normalizeOptions(['a', 'b', 'c'])).toEqual({ a: 'a', b: 'b', c: 'c' });
  });

  it('uses labels map when provided with matching keys', () => {
    const labels = { a: 'Option A', b: 'Option B' };
    expect(normalizeOptions(['a', 'b'], labels)).toEqual({
      'Option A': 'a',
      'Option B': 'b',
    });
  });

  it('falls back to String(item) for items missing from labels map', () => {
    const labels = { a: 'Option A' };
    expect(normalizeOptions(['a', 'b'], labels)).toEqual({
      'Option A': 'a',
      b: 'b',
    });
  });

  it('falls back to String(item) when a label key exists but its value is undefined', () => {
    // Regression guard: { reverse: undefined } previously printed "undefined" as the label
    // because Object.hasOwn found the key before we checked the value type.
    const labels = { Bat: undefined as any, Cat: 'Catwoman' };
    expect(normalizeOptions(['Bat', 'Cat'], labels)).toEqual({
      Bat: 'Bat',
      Catwoman: 'Cat',
    });
  });

  it('does not resolve Array.prototype methods when labels is an array (issue #30142)', () => {
    // When Svelte docgen incorrectly passes an array as `labels`, items whose name
    // matches an Array prototype method (e.g. 'reverse') must NOT resolve to the
    // native function — they should fall back to String(item).
    const labelsAsArray: any = ['first', 'second', 'third'];
    const options = ['reverse', 'map', 'filter'];
    const result = normalizeOptions(options, labelsAsArray);
    expect(result).toEqual({ reverse: 'reverse', map: 'map', filter: 'filter' });
    expect(Object.keys(result as object)).not.toContain('function reverse() { [native code] }');
  });

  it('returns the options object unchanged when options is not an array', () => {
    const obj = { 'Option A': 'a', 'Option B': 'b' };
    expect(normalizeOptions(obj as any)).toBe(obj);
  });
});
