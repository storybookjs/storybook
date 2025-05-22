/* eslint-disable local-rules/no-uncategorized-errors */
import { getProjectRoot } from 'storybook/internal/common';

import boxen, { type Options } from 'boxen';
// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';

export const printBoxedMessage = (message: string, style?: Options) =>
  boxen(message, { borderStyle: 'round', padding: 1, borderColor: '#F1618C', ...style });

export const findStorybookProjects = async (): Promise<string[]> => {
  // Get project root
  const gitRootDir = getProjectRoot();

  // Find all .storybook directories, though we need to later on account for custom config dirs
  const storybookDirs = await globby('**/.storybook', {
    cwd: gitRootDir,
    gitignore: true,
    absolute: true,
  });

  if (storybookDirs.length === 0) {
    throw new Error('No Storybook projects found in the repository');
  }

  return storybookDirs;
};
