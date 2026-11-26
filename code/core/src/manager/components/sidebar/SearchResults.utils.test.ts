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

    it('should resolve the exact continuous input range', () => {
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

    it("should keep Fuse's ranges for a match in which neither the input nor its tokens occur", () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Button',
          indices: [[0, 5]],
          arrayIndex: 0,
        },
        {
          key: 'path',
          value: 'Button Group',
          indices: [
            [0, 5],
            [9, 10],
          ],
          arrayIndex: 1,
        },
      ];

      expect(resolveHighlightRanges(matches, 'buton')).toEqual(matches);
    });

    it('should resolve each match on its own', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Primary',
          indices: [[0, 6]],
          arrayIndex: 0,
        },
        {
          key: 'path',
          value: 'Button',
          indices: [[0, 5]],
          arrayIndex: 1,
        },
      ];

      expect(resolveHighlightRanges(matches, 'buton prim')).toEqual([
        {
          key: 'name',
          value: 'Primary',
          indices: [[0, 3]],
          arrayIndex: 0,
        },
        {
          key: 'path',
          value: 'Button',
          indices: [[0, 5]],
          arrayIndex: 1,
        },
      ]);
    });

    it('should resolve each token of a multi-word input', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Primary',
          indices: [[0, 6]],
          arrayIndex: 0,
        },
        {
          key: 'path',
          value: 'Button Group',
          indices: [
            [0, 6],
            [8, 11],
          ],
          arrayIndex: 1,
        },
      ];

      expect(resolveHighlightRanges(matches, 'button primary')).toEqual([
        {
          key: 'name',
          value: 'Primary',
          indices: [[0, 6]],
          arrayIndex: 0,
        },
        {
          key: 'path',
          value: 'Button Group',
          indices: [[0, 5]],
          arrayIndex: 1,
        },
      ]);
    });

    it('should prefer the whole input over its tokens', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'With Long Label',
          indices: [[4, 14]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'long label')).toEqual([
        {
          key: 'name',
          value: 'With Long Label',
          indices: [[5, 14]],
          arrayIndex: 0,
        },
      ]);
    });

    it('should prefer the longest token when one token starts with another', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Button',
          indices: [[0, 5]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'b butt')).toEqual([
        {
          key: 'name',
          value: 'Button',
          indices: [[0, 3]],
          arrayIndex: 0,
        },
      ]);
    });

    it('should resolve an input with a trailing space', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Button',
          indices: [[0, 5]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, 'Button ')).toEqual([
        {
          key: 'name',
          value: 'Button',
          indices: [[0, 5]],
          arrayIndex: 0,
        },
      ]);
    });

    it('should treat regular expression syntax in the input literally', () => {
      const matches: Match[] = [
        {
          key: 'name',
          value: 'Button (primary)',
          indices: [[7, 15]],
          arrayIndex: 0,
        },
      ];

      expect(resolveHighlightRanges(matches, '(primary)')).toEqual([
        {
          key: 'name',
          value: 'Button (primary)',
          indices: [[7, 15]],
          arrayIndex: 0,
        },
      ]);
    });

    it('should keep the original matches when the input is empty', () => {
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

    it('should resolve all continuous input occurrences', () => {
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
