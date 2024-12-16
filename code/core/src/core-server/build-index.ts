import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolve } from 'node:path';

import { loadAllPresets, loadMainConfig, normalizeStories } from '@storybook/core/common';
import type { BuilderOptions, CLIOptions, LoadOptions } from '@storybook/core/types';

import { logger } from '@storybook/core/node-logger';

import { StoryIndexGenerator } from './utils/StoryIndexGenerator';

type BuildIndexOptions = CLIOptions & LoadOptions & BuilderOptions & { outputFile: string };

export const buildIndex = async (options: BuildIndexOptions) => {
  const configDir = resolve(options.configDir ?? '.storybook');
  const config = await loadMainConfig({
    configDir,
    noCache: true,
  });

  const { framework } = config;
  const corePresets = [];

  const frameworkName = typeof framework === 'string' ? framework : framework?.name;
  if (frameworkName) {
    corePresets.push(join(frameworkName, 'preset'));
  } else if (!options.ignorePreview) {
    logger.warn(`you have not specified a framework in your ${options.configDir}/main.js`);
  }

  const presets = await loadAllPresets({
    corePresets: [
      require.resolve('@storybook/core/core-server/presets/common-preset'),
      ...corePresets,
    ],
    overridePresets: [
      require.resolve('@storybook/core/core-server/presets/common-override-preset'),
    ],
    isCritical: true,
    ...options,
  });
  const [indexers, stories, docsOptions] = await Promise.all([
    // presets.apply('features'),
    presets.apply('experimental_indexers', []),
    presets.apply('stories', []),
    presets.apply('docs', {}),
  ]);

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
  const index = await generator.getIndex();
  return index;
};

export const buildIndexStandalone = async (options: BuildIndexOptions) => {
  const index = await buildIndex(options);
  console.log(`Writing index to ${options.outputFile}`);
  await writeFile(options.outputFile, JSON.stringify(index, null, 2));
};
