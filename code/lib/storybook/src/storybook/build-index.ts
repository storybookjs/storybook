import { writeFile } from 'node:fs/promises';

import { createStorybook, getInstanceContext } from 'storybook/internal/instance';
import { logger } from '@storybook/core/internal/node-logger';
import type {
  BuilderOptions,
  CLIOptions,
  LoadOptions,
  StoryIndex,
} from '@storybook/core/internal/types';

export type BuildIndexOptions = CLIOptions & LoadOptions & BuilderOptions;

/** Index the Storybook in `configDir`, or the current instance when called from inside one. */
export async function buildIndex(options: BuildIndexOptions): Promise<StoryIndex> {
  const current = getInstanceContext()?.storybook;
  if (current) {
    return current.getIndex();
  }
  const storybook = await createStorybook({
    configDir: options.configDir,
    mode: 'headless',
    cliOptions: options,
  });
  try {
    return await storybook.getIndex();
  } finally {
    await storybook.close();
  }
}

export async function buildIndexStandalone(
  options: BuildIndexOptions & { outputFile: string }
): Promise<void> {
  const index = await buildIndex(options);
  logger.info(`Writing index to ${options.outputFile}`);
  await writeFile(options.outputFile, JSON.stringify(index));
}
