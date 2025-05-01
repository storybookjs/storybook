import { existsSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

interface Options {
  dotStorybookReferences: string[];
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

const getDotStorybookReferences = async () => {
  try {
    // eslint-disable-next-line depend/ban-dependencies
    const { $ } = await import('execa');
    const { stdout } = await $`git grep -l \\.storybook`;
    return stdout.split('\n').filter(Boolean);
  } catch (error) {
    return [];
  }
};

export const rnstorybookConfig: Fix<Options, 'rnstorybook-config'> = {
  id: 'rnstorybook-config',

  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

  async check({ packageManager, mainConfigPath }) {
    const allDependencies = await packageManager.getAllDependencies();

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
      const dotStorybookReferences = await getDotStorybookReferences();
      return { storybookDir, rnStorybookDir, dotStorybookReferences };
    }

    return null;
  },

  prompt({ dotStorybookReferences }) {
    const references =
      dotStorybookReferences.length > 0
        ? dedent`
          We will update the following files to reference ${picocolors.yellow('.rnstorybook')}:
          ${dotStorybookReferences.map((ref: string) => picocolors.cyan('- ' + ref)).join('\n')}
        `.trim()
        : dedent`
          Oddly, we did not find any source files that reference the ${picocolors.yellow('.storybook')} directory.
          If they exist, please update them by hand to reference ${picocolors.yellow('.rnstorybook')} instead.
        `.trim();

    return dedent`
      In Storybook 9, React Native projects use the ${picocolors.yellow('.rnstorybook')} directory for
      configuration instead of ${picocolors.yellow('.storybook')}.

      ${references}

      More info: ${picocolors.cyan('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-config-dir-renamed')}

      Would you like to automatically move your config files to the new location?`;
  },

  async run({ result: { storybookDir, rnStorybookDir, dotStorybookReferences }, dryRun }) {
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
