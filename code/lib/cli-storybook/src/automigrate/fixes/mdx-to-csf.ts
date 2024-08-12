import type { StoriesEntry } from 'storybook/internal/types';

import { runCodemod } from '@storybook/codemod';

import chalk from 'chalk';
import { glob } from 'glob';
import { prompt } from 'prompts';
import { dedent } from 'ts-dedent';

import { updateMainConfig } from '../helpers/mainConfigFile';
import type { Fix } from '../types';

const logger = console;

export interface BareMdxStoriesGlobRunOptions {
  existingStoriesEntries: StoriesEntry[];
  nextStoriesEntries: StoriesEntry[];
  files: string[];
}

const getNextGlob = (globString: string) => {
  // '../src/**/*.stories.@(mdx|js|jsx|ts|tsx)' -> '../src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))'
  const extGlobsRegex = new RegExp(/(.*\.)(stories\.@.*)(\|mdx|mdx\|)(.*)$/i);
  if (globString.match(extGlobsRegex)) {
    return globString.replace(extGlobsRegex, '$1@(mdx|$2$4)');
  }

  // '../src/**/*.stories.*' -> '../src/**/*.@(mdx|stories.*)'
  const allStoriesExtensionsRegex = new RegExp(/(.*\.)(stories\.\*)$/i);
  if (globString.match(allStoriesExtensionsRegex)) {
    return globString.replace(allStoriesExtensionsRegex, '$1@(mdx|$2)');
  }

  // '../src/**/*.stories.mdx' -> '../src/**/*.mdx'
  return globString.replaceAll('.stories.mdx', '.mdx');
};

export const mdxToCSF: Fix<BareMdxStoriesGlobRunOptions> = {
  id: 'mdx-to-csf',
  versionRange: ['<7', '>=7'],
  async check({ mainConfig }) {
    const existingStoriesEntries = mainConfig.stories as StoriesEntry[];

    if (!existingStoriesEntries) {
      throw new Error(dedent`
        ❌ Unable to determine Storybook stories globs in ${chalk.blue(
          mainConfig
        )}, skipping ${chalk.cyan(this.id)} fix.
        
        In Storybook 7, we have deprecated defining stories in MDX files, and consequently have changed the suffix to simply .mdx.

        Now, since Storybook 8.0, we have removed support for .stories.mdx files.

        We were unable to automatically migrate your 'stories' config to include any .mdx file instead of just .stories.mdx.
        We suggest you make this change manually.
        To learn more about this change, see: ${chalk.yellow(
          'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#mdx-docs-files'
        )}
      `);
    }

    const files: string[] = [];

    const nextStoriesEntries = await Promise.all(
      existingStoriesEntries.map(async (entry) => {
        const isSpecifier = typeof entry !== 'string';
        const globString = isSpecifier ? entry.files : entry;

        if (!globString) {
          // storySpecifier without the 'files' property. Just add the existing to the next list
          return entry;
        }

        files.push(...(await glob(globString)).filter((file) => file.endsWith('.stories.mdx')));

        const nextGlob = getNextGlob(globString);
        return isSpecifier ? { ...entry, files: nextGlob } : nextGlob;
      })
    );

    const resultFromMainConfig = checkMainConfigStories(existingStoriesEntries, nextStoriesEntries);

    if ((nextStoriesEntries && resultFromMainConfig) || files.length > 0) {
      return { existingStoriesEntries, nextStoriesEntries, files };
    }

    // bails if there are no changes, no files to migrate, or if the nextStoriesEntries is empty
    return null;
  },

  prompt({ existingStoriesEntries, nextStoriesEntries }) {
    const prettyExistingStoriesEntries = existingStoriesEntries
      .map((entry) => JSON.stringify(entry, null, 2))
      .join('\n');
    const prettyNextStoriesEntries = nextStoriesEntries
      .map((entry) => JSON.stringify(entry, null, 2))
      .join('\n');
    return dedent`
      We've detected your project has one or more globs in your 'stories' config that matches .stories.mdx files:
        ${chalk.cyan(prettyExistingStoriesEntries)}
      
      In Storybook 7, we have deprecated defining stories in MDX files, and consequently have changed the suffix to simply .mdx. Since Storybook 8, we have removed the support of story definition in MDX files entirely. Therefore '.stories.mdx' files aren't supported anymore.

      Now, since Storybook 8.0, we have removed support for .stories.mdx files.

      We can automatically migrate your 'stories' config to include any .mdx file instead of just .stories.mdx.
      That would result in the following 'stories' config:
        ${chalk.cyan(prettyNextStoriesEntries)}

      Additionally, we will run the 'mdx-to-csf' codemod for you, which tries to transform '*.stories.mdx' files to '*.stories.js' and '*.mdx' files.

      To learn more about this change, see: ${chalk.yellow(
        'https://storybook.js.org/docs/migration-guide#storiesmdx-to-mdxcsf'
      )}
    `;
  },

  async run({ dryRun, mainConfigPath, result: { nextStoriesEntries } }) {
    logger.info(dedent`✅ Setting 'stories' config:
      ${JSON.stringify(nextStoriesEntries, null, 2)}`);

    if (!dryRun) {
      const { glob: globString } = await prompt({
        type: 'text',
        name: 'glob',
        message: 'Please enter the glob for your MDX stories',
        initial: './src/**/*.stories.mdx',
      });

      if (globString) {
        await runCodemod('mdx-to-csf', { glob: globString, dryRun, logger });
      }

      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        main.setFieldValue(['stories'], nextStoriesEntries);
      });

      logger.info(dedent`
        The migration successfully updated your 'stories' config to include any .mdx file instead of just .stories.mdx.

        It also ran the 'mdx-to-csf' codemod to convert your MDX stories to CSF format.
        This codemod is not perfect however, so you may need to manually fix any issues it couldn't handle.
      `);
    }
  },
};
function checkMainConfigStories(
  existingStoriesEntries: StoriesEntry[],
  nextStoriesEntries: StoriesEntry[]
) {
  if (
    existingStoriesEntries.length === nextStoriesEntries.length &&
    existingStoriesEntries.every((entry, index) => {
      const nextEntry = nextStoriesEntries[index];
      if (typeof entry === 'string') {
        return entry === nextEntry;
      }
      if (typeof nextEntry === 'string') {
        return false;
      }
      return entry.files === nextEntry.files;
    })
  ) {
    return null;
  }
  return true;
}
