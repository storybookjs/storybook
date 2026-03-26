import type { StoryIndex } from 'storybook/internal/types';

/** Takes the story index and returns an array of unique import paths. */
export function getUniqueImportPaths(index: StoryIndex): string[] {
  return [...new Set(Object.values(index.entries).map((entry) => entry.importPath))];
}
