import { writeFile } from 'node:fs/promises';

import { normalizeStories } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { BuilderOptions, CLIOptions, LoadOptions } from 'storybook/internal/types';

import { loadStorybook } from './load';
import { StoryIndexGenerator } from './utils/StoryIndexGenerator';

export type BuildIndexOptions = CLIOptions & LoadOptions & BuilderOptions;

export const buildIndex = async (options: BuildIndexOptions) => {
  const { presets } = await loadStorybook(options);
  const [indexers, stories, docsOptions] = await Promise.all([
    presets.apply('experimental_indexers', []),
    presets.apply('stories', []),
    presets.apply('docs'),
  ]);

  const { configDir } = options;
  const workingDir = process.cwd();
  const directories = {
    configDir,
    workingDir,
  };
  const normalizedStories = normalizeStories(stories, directories);

  const generator = new StoryIndexGenerator(normalizedStories, {
    ...directories,
    indexers,
    docs: docsOptions,
    build: {},
  });

  await generator.initialize();
  return generator.getIndex();
};

export const buildIndexStandalone = async (options: BuildIndexOptions & { outputFile: string }) => {
  const index = await buildIndex(options);
  logger.info(`Writing index to ${options.outputFile}`);
  await writeFile(options.outputFile, JSON.stringify(index));
};
