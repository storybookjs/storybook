import { describe, expect, it } from 'vitest';

import { stableStringify } from './stable-stringify.ts';

describe('stableStringify', () => {
  it('sorts keys at every depth so a re-record diffs on content only', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } }, 0)).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('leaves array order alone, which carries meaning', () => {
    expect(stableStringify({ value: ['sm', 'lg'] }, 0)).toBe('{"value":["sm","lg"]}');
  });
});
