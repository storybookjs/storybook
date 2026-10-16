import { normalizeStories } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { StoryIndexGenerator } from './StoryIndexGenerator.ts';

/**
 * Resolves story file paths from a main config's `stories` field without evaluating story files.
 *
 * @example
 *
 * ```typescript
 * const storiesPaths = await getStoriesPathsFromConfig({
 *   stories: ['src\/**\/*.stories.tsx'],
 *   configDir: '/path/to/.storybook',
 *   workingDir: '/path/to/project',
 * });
 * ```
 */
export const getStoriesPathsFromConfig = async ({
  stories,
  configDir,
  workingDir,
}: {
  stories: StorybookConfigRaw['stories'];
  configDir: string;
  workingDir: string;
}) => {
  if (stories.length === 0) {
    return [];
  }

  const normalizedStories = normalizeStories(stories, { configDir, workingDir });

  const matchingStoryFiles = await StoryIndexGenerator.findMatchingFilesForSpecifiers(
    normalizedStories,
    workingDir,
    true
  );

  return matchingStoryFiles.flatMap(([specifier, cache]) =>
    StoryIndexGenerator.storyFileNames(new Map([[specifier, cache]]))
  );
};
