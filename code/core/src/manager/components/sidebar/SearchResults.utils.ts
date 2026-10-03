import type { Match } from './types.ts';

const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const resolveHighlightRanges = (matches: Match[], input: string): Match[] => {
  if (!input) {
    return matches;
  }

  const pattern = new RegExp(escapeRegExp(input), 'giu');

  return matches.map((match) => {
    const indices: [number, number][] = Array.from(match.value.matchAll(pattern)).map((result) => [
      result.index,
      result.index + result[0].length - 1,
    ]);

    return {
      ...match,
      indices,
    };
  });
};
