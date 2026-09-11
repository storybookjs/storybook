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

    it('should return no indices when the query is not a substring', () => {
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

      expect(resolveHighlightRanges(matches, 'xyz')).toEqual([
        {
          key: 'name',
          value: 'Header',
          indices: [],
          arrayIndex: 0,
        },
      ]);
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

    it('should resolve all continuous query occurrences', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'HeaderHeader',
          indices: [
            [1, 2],
            [4, 4],
            [7, 8],
            [10, 10],
          ],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'ea')).toEqual([
        {
          key: 'name',
          value: 'HeaderHeader',
          indices: [
            [1, 2],
            [7, 8],
          ],
          arrayIndex: 0,
        },
      ]);
    });

    it('should preserve original string offsets for Unicode case-insensitive matches', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'İx',
          indices: [[0, 1]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'x')).toEqual([
        {
          key: 'name',
          value: 'İx',
          indices: [[1, 1]],
          arrayIndex: 0,
        },
      ]);
    });
  });
});
