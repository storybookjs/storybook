/* eslint-disable local-rules/no-uncategorized-errors */
import { type JsPackageManager, getProjectRoot } from 'storybook/internal/common';

import boxen, { type Options } from 'boxen';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import prompts from 'prompts';

import { getStorybookData } from './automigrate/helpers/mainConfigFile';

const logger = console;

export const printBoxedMessage = (message: string, style?: Options) =>
  boxen(message, { borderStyle: 'round', padding: 1, borderColor: '#F1618C', ...style });

export const findStorybookProjects = async (): Promise<string[]> => {
  // Get project root
  const gitRootDir = getProjectRoot();

  // Find all .storybook directories, though we need to later on account for custom config dirs
  const storybookDirs = await glob('**/.storybook', {
    cwd: gitRootDir,
    ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });

  if (storybookDirs.length === 0) {
    throw new Error('No Storybook projects found in the repository');
  }

  return storybookDirs;
};

export const selectStorybookProjects = async (projects: string[]): Promise<string[]> => {
  const { selectedProjects } = await prompts(
    {
      type: 'multiselect',
      name: 'selectedProjects',
      message: 'Select which Storybook projects to use',
      choices: projects.map((project) => ({
        title: project.replace(getProjectRoot(), ''),
        value: project,
      })),
      instructions: 'Use space to select, enter to confirm',
    },
    {
      onCancel: () => {
        process.exit(0);
      },
    }
  );

  if (!selectedProjects || selectedProjects.length === 0) {
    logger.info('No projects selected for migration');
    return [];
  }

  return selectedProjects;
};
