import type { Match } from './types.ts';

export const resolveHighlightRanges = (matches: Match[], query: string): Match[] => {
  if (!query) {
    return matches;
  }

  const needle = query.toLowerCase();

  return matches.map((match) => {
    const start = match.value.toLowerCase().indexOf(needle);

    return start === -1
      ? match
      : {
          ...match,
          indices: [[start, start + needle.length - 1]],
        };
  });
};
