import { getProjectRoot, prompt } from 'storybook/internal/common';

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
    dot: true,
    gitignore: true,
    absolute: true,
    onlyDirectories: true,
  });

  if (storybookDirs.length === 0) {
    const answer = await prompt.text({
      message:
        'No Storybook projects were found. Please enter the path to the .storybook directory for the project you want to upgrade.',
    });
    return [answer];
  }

  return storybookDirs;
};
