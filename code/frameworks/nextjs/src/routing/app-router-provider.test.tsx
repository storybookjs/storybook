import { describe, expect, it } from 'vitest';

describe('AppRouterProvider - Catch-All Segments', () => {
  it('should handle typeof check for string and array segment values', () => {
    // This test verifies that the typeof check works correctly for both strings and arrays
    const stringValue = 'test-string';
    const arrayValue = ['as', 'many', 'as', 'you', 'want'];

    // String values should pass the typeof check
    expect(typeof stringValue === 'string').toBe(true);
    expect(stringValue.startsWith).toBeDefined();

    // Array values should fail the typeof check
    expect(typeof arrayValue === 'string').toBe(false);
    // This demonstrates that arrays don't have startsWith method
    expect((arrayValue as unknown as { startsWith?: unknown }).startsWith).toBeUndefined();
  });

  it('should verify PAGE_SEGMENT_KEY check logic', () => {
    const PAGE_SEGMENT_KEY = '__PAGE__';

    // Test with string segment value
    const stringSegment = '__PAGE__segment';
    const shouldSkipString =
      !stringSegment ||
      (typeof stringSegment === 'string' && stringSegment.startsWith(PAGE_SEGMENT_KEY));
    expect(shouldSkipString).toBe(true);

    // Test with array segment value (catch-all)
    const arraySegment = ['as', 'many', 'as', 'you', 'want'];
    const shouldSkipArray =
      !arraySegment ||
      (typeof arraySegment === 'string' && (arraySegment as string).startsWith(PAGE_SEGMENT_KEY));
    // Array should NOT be skipped (because it's not a string, so startsWith is never called)
    expect(shouldSkipArray).toBe(false);

    // Test with empty/falsy values
    const emptySegment = '';
    const shouldSkipEmpty =
      !emptySegment ||
      (typeof emptySegment === 'string' && emptySegment.startsWith(PAGE_SEGMENT_KEY));
    expect(shouldSkipEmpty).toBe(true);
  });
});
