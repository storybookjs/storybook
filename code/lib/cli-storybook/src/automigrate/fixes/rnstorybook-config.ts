import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

interface Options {
  storybookDir: string;
  rnStorybookDir: string;
}

/** Replaces all occurrences of a string in a file with another string */
async function renameInFile(filePath: string, oldText: string, newText: string): Promise<void> {
  try {
    const content = await readFile(filePath, 'utf8');
    const updatedContent = content.replaceAll(oldText, newText);
    await writeFile(filePath, updatedContent, 'utf8');
  } catch (error) {
    console.error(`Error updating references in ${filePath}:`, error);
  }
}

const getDotStorybookReferences = async (searchDir: string) => {
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const { readFile } = await import('node:fs/promises');

    // Find all relevant files (excluding common directories that shouldn't be searched)
    const files = await globby(`${searchDir}/**/*`, {
      onlyFiles: true,
      gitignore: true,
    });

    const referencedFiles: string[] = [];

    // Check each file for .storybook references
    await Promise.all(
      files.map(async (file) => {
        try {
          const content = await readFile(file, 'utf8');
          if (content.includes('.storybook')) {
            referencedFiles.push(file);
          }
        } catch {
          // Skip files that can't be read (e.g., binary files)
        }
      })
    );

    return referencedFiles;
  } catch (fsError) {
    console.warn('Unable to search for .storybook references:', fsError);
    return [];
  }
};

export const rnstorybookConfig: Fix<Options> = {
  id: 'rnstorybook-config',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-config-dir-renamed',

  async check({ packageManager, mainConfigPath }) {
    const allDependencies = packageManager.getAllDependencies();

    if (!allDependencies['@storybook/react-native']) {
      return null;
    }

    // Check if .storybook directory exists
    const projectDir = mainConfigPath ? join(mainConfigPath, '..', '..') : process.cwd();
    const storybookDir = join(projectDir, '.storybook');
    const rnStorybookDir = join(projectDir, '.rnstorybook');
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const requiresFiles = await globby(join(storybookDir, 'storybook.requires.*'));

    if (existsSync(storybookDir) && requiresFiles.length > 0 && !existsSync(rnStorybookDir)) {
      return { storybookDir, rnStorybookDir };
    }

    return null;
  },

  prompt() {
    return dedent`We'll rename your .storybook directory to .rnstorybook and update all references to it.`;
  },

  async run({ result: { storybookDir, rnStorybookDir }, dryRun, packageManager }) {
    const instanceDir = packageManager.instanceDir;
    const dotStorybookReferences = await getDotStorybookReferences(instanceDir);

    if (!dryRun) {
      await Promise.all(
        dotStorybookReferences.map(async (ref) => {
          await renameInFile(ref, '.storybook', '.rnstorybook');
        })
      );
      await rename(storybookDir, rnStorybookDir);
    }
  },
};
