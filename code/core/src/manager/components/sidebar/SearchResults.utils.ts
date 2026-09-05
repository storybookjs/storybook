import type { Match } from './types.ts';

export const resolveHighlightRanges = (matches: Match[], query: string): Match[] => {
  if (!query) {
    return matches;
  }

  const needle = query.toLowerCase();

  return matches.map((match) => {
    const value = match.value.toLowerCase();
    const indices: [number, number][] = [];

    let start = value.indexOf(needle);

    while (start !== -1) {
      indices.push([start, start + needle.length - 1]);
      start = value.indexOf(needle, start + needle.length);
    }

    return indices.length > 0
      ? {
          ...match,
          indices,
        }
      : match;
  });
};
