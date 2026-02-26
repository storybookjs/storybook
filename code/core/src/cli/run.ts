import { buildRunStandalone } from 'storybook/internal/core-server';
import type { CLIOptions, StoryRunOptions } from 'storybook/internal/types';

export const run = async (cliOptions: CLIOptions) => {
  const { env } = process;
  env.NODE_ENV = env.NODE_ENV || 'development';

  const options: StoryRunOptions & CLIOptions = {
    ...cliOptions,
    configDir: cliOptions.configDir || './.storybook',
    storyIds: cliOptions.story as string[],
  } as unknown as StoryRunOptions & CLIOptions;

  await buildRunStandalone(options);
};
