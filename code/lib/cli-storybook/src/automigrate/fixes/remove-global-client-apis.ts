import chalk from 'chalk';
import { dedent } from 'ts-dedent';
import { readFile } from 'node:fs/promises';
import type { Fix } from '../types';

export enum RemovedAPIs {
  addDecorator = 'addDecorator',
  addParameters = 'addParameters',
  addLoader = 'addLoader',
  getStorybook = 'getStorybook',
  setAddon = 'setAddon',
  clearDecorators = 'clearDecorators',
}

interface GlobalClientAPIOptions {
  usedAPIs: RemovedAPIs[];
  previewPath: string;
}

export const removedGlobalClientAPIs: Fix<GlobalClientAPIOptions> = {
  id: 'removedglobalclientapis',
  promptType: 'manual',

  versionRange: ['<7', '>=7'],

  async check({ previewConfigPath }) {
    if (previewConfigPath) {
      const contents = await readFile(previewConfigPath, 'utf8');

      const usedAPIs = Object.values(RemovedAPIs).reduce((acc, item) => {
        if (contents.includes(item)) {
          acc.push(item);
        }
        return acc;
      }, [] as RemovedAPIs[]);

      if (usedAPIs.length) {
        return {
          usedAPIs,
          previewPath: previewConfigPath,
        };
      }
    }

    return null;
  },
  prompt({ usedAPIs, previewPath }) {
    return dedent`
      ${chalk.bold(
        chalk.red('Attention')
      )}: We could not automatically make this change. You'll need to do it manually.

      The following APIs (used in "${chalk.yellow(previewPath)}") have been removed from Storybook:
      
      ${usedAPIs.map((api) => `- ${chalk.cyan(api)}`).join('\n')}

      Please see the migration guide for more information:
      ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#removed-global-client-apis'
      )}
    `;
  },
};
