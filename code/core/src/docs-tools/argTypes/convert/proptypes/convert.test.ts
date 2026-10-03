import { describe, expect, it } from 'vitest';

import { convert } from './convert.ts';

describe('convert (proptypes)', () => {
  describe('union flattening for large union types', () => {
    it('flattens a union of single-value enums into one enum', () => {
      // react-docgen-typescript emits each literal as a separate single-value enum
      // when the union exceeds its internal member limit (around 28 values).
      const largeLiteralUnion = {
        name: 'union',
        value: ['k1', 'k2', 'k3', 'k4', 'k5'].map((k) => ({
          name: 'enum',
          value: [{ value: `'${k}'` }],
        })),
      };

      expect(convert(largeLiteralUnion as any)).toEqual({
        name: 'enum',
        value: ['k1', 'k2', 'k3', 'k4', 'k5'],
      });
    });

    it('does not flatten a union of mixed types', () => {
      const mixedUnion = {
        name: 'union',
        value: [
          { name: 'string' },
          { name: 'number' },
        ],
      };

      expect(convert(mixedUnion as any)).toEqual({
        name: 'union',
        value: [{ name: 'string' }, { name: 'number' }],
      });
    });
  });

  describe('pipe-separated name fallback', () => {
    it('parses single-quoted string literals from pipe-separated type names', () => {
      // react-docgen-typescript-plugin puts the raw union string in `name`
      // when shouldExtractValuesFromUnion is off.  Single quotes are valid TS
      // but JSON.parse rejects them — parseLiteral handles both.
      const singleQuotedUnion = { name: `'foo'|'bar'|'baz'` };

      expect(convert(singleQuotedUnion as any)).toEqual({
        name: 'enum',
        value: ['foo', 'bar', 'baz'],
      });
    });

    it('parses double-quoted string literals from pipe-separated type names', () => {
      const doubleQuotedUnion = { name: `"foo"|"bar"` };

      expect(convert(doubleQuotedUnion as any)).toEqual({
        name: 'enum',
        value: ['foo', 'bar'],
      });
    });

    it('parses numeric literals from pipe-separated type names', () => {
      const numericUnion = { name: `1|2|3` };

      expect(convert(numericUnion as any)).toEqual({
        name: 'enum',
        value: [1, 2, 3],
      });
    });
  });
});
