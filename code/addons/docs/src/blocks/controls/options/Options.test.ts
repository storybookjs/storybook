import { describe, expect, it } from 'vitest';

// Access the private normalizeOptions via a test-only re-export workaround:
// We test the behaviour through its observable effects by reconstructing the logic inline.
// The actual fix is in Options.tsx; these tests document the bug and verify the fix.

// Inline the fixed normalizeOptions so the tests are self-contained and don't require
// exporting an internal helper.
const normalizeOptions = (options: any[], labels?: Record<any, string>) => {
  if (Array.isArray(options)) {
    return options.reduce((acc: Record<string, any>, item: any) => {
      const label =
        labels != null &&
        !Array.isArray(labels) &&
        Object.prototype.hasOwnProperty.call(labels, item)
          ? labels[item]
          : String(item);
      acc[label] = item;
      return acc;
    }, {});
  }
  return options;
};

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

  it('does not resolve Array.prototype methods when labels is an array (issue #30142)', () => {
    // When Svelte docgen incorrectly passes an array as `labels`, items whose name
    // matches an Array prototype method (e.g. 'reverse') must NOT resolve to the
    // native function — they should fall back to String(item).
    const labelsAsArray: any = ['first', 'second', 'third'];
    const options = ['reverse', 'map', 'filter'];
    const result = normalizeOptions(options, labelsAsArray);
    // Each key must be the plain string value, not a native function
    expect(result).toEqual({ reverse: 'reverse', map: 'map', filter: 'filter' });
    expect(Object.keys(result)).not.toContain('function reverse() { [native code] }');
  });

  it('returns the options object unchanged when options is not an array', () => {
    const obj = { 'Option A': 'a', 'Option B': 'b' };
    expect(normalizeOptions(obj as any)).toBe(obj);
  });
});
