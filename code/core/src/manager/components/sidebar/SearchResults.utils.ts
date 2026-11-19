import type { Match } from './types.ts';

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Replaces the ranges Fuse reports with the ranges where the input literally occurs.
 *
 * Fuse marks every character that appears anywhere in the input, so its ranges cover characters
 * outside the actual match. Fuse also searches each space-separated token of the input on its own,
 * so a range is an occurrence of the whole input or of one of its tokens, whichever is longest.
 *
 * A match Fuse only found through fuzzy matching, such as a typo, has no literal occurrence. It is
 * dropped, so that its value renders without highlight.
 */
export const resolveHighlightRanges = (matches: Match[], input: string): Match[] => {
  if (!input) {
    return matches;
  }

  const terms = [...new Set([input, ...input.split(/ +/)])]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(terms.map(escapeRegExp).join('|'), 'giu');

  return matches.flatMap((match) => {
    const indices: [number, number][] = Array.from(match.value.matchAll(pattern)).map((result) => [
      result.index,
      result.index + result[0].length - 1,
    ]);

    return indices.length ? [{ ...match, indices }] : [];
  });
};
