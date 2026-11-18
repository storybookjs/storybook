import type { StoryIndex, StoryIndexEntry } from 'storybook/internal/types';

import { isAbsolute, join, normalize, relative, resolve } from 'pathe';

/** Story files and the stories in them, as story index import paths and entry ids. */
export type StorySelection = { storyFiles: string[]; storyIds: string[] };

/**
 * Story files matching any filter, the way Vitest matches its file filters against test files: a
 * case-insensitive substring of the path relative to the current directory, or, for an absolute
 * filter, a path prefix (a file or a directory). A filter that matches nothing is ignored.
 */
export function filterStoryFiles({
  index,
  filters,
}: {
  index: StoryIndex;
  filters: string[];
}): StorySelection {
  // Story index import paths and relative filters are both relative to the current directory.
  const cwd = process.cwd();
  const byFile = new Map<string, StoryIndexEntry[]>();
  for (const entry of Object.values(index.entries)) {
    if (entry.type === 'story' && !entry.importPath.startsWith('virtual:')) {
      const file = resolve(cwd, entry.importPath);
      byFile.set(file, [...(byFile.get(file) ?? []), entry]);
    }
  }

  const matched = [...byFile.keys()].filter((file) => {
    const fromCwd = relative(cwd, file).toLocaleLowerCase();
    return filters.some((rawFilter) => {
      const filter = normalize(rawFilter);
      if (isAbsolute(filter) && file.startsWith(filter)) {
        return true;
      }
      const fromCwdFilter = rawFilter.endsWith('/')
        ? join(relative(cwd, filter), '/')
        : relative(cwd, filter);
      return (
        fromCwd.includes(filter.toLocaleLowerCase()) ||
        fromCwd.includes(fromCwdFilter.toLocaleLowerCase())
      );
    });
  });

  const entries = matched.flatMap((file) => byFile.get(file) ?? []);
  return {
    storyFiles: [...new Set(entries.map((entry) => entry.importPath))],
    storyIds: entries.map((entry) => entry.id),
  };
}
