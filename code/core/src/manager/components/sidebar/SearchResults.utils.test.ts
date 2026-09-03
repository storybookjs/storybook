import { describe, expect, it } from 'vitest';

import type { Match } from './types.ts';

import { resolveHighlightRanges } from './SearchResults.utils.ts';

describe('SearchResults.utils', () => {
  describe('resolveHighlightRanges', () => {
    it('should resolve a case-insensitive continuous match', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Header',
          indices: [
            [1, 2],
            [4, 4],
          ],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'EA')).toEqual([
        {
          key: 'name',
          value: 'Header',
          indices: [[1, 2]],
          arrayIndex: 0,
        },
      ]);
    });

    it('should resolve the exact continuous query range', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Header',
          indices: [[0, 4]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'head')).toEqual([
        {
          key: 'name',
          value: 'Header',
          indices: [[0, 3]],
          arrayIndex: 0,
        },
      ]);
    });

    it('should keep the original match when the query is not a substring', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Header',
          indices: [
            [0, 0],
            [2, 2],
          ],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'xyz')).toEqual(matches);
    });

    it('should keep the original matches when the query is empty', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Header',
          indices: [[1, 2]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, '')).toEqual(matches);
    });
  });
});
