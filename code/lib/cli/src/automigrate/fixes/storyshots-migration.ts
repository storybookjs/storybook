import chalk from 'chalk';
import { dedent } from 'ts-dedent';
import type { Fix } from '../types';

export const storyshotsMigration: Fix = {
  id: 'storyshots',
  versionRange: ['<8.0.0-alpha.0', '>=8.0.0-alpha.0'],
  promptType: 'manual',

  async check({ mainConfig, packageManager }) {
    const allDeps = await packageManager.getAllDependencies();
    const hasStoryshots =
      allDeps['@storybook/addon-storyshots'] ||
      mainConfig.addons?.find((addon) => {
        const addonName = typeof addon === 'string' ? addon : addon.name;
        return addonName.includes('@storybook/addon-storyshots');
      });

    return hasStoryshots ?? null;
  },
  prompt() {
    return dedent`
      ${chalk.bold(
        'Attention'
      )}: Storyshots is now officially deprecated, is no longer being maintained, and was removed in Storybook 8. 

      We recommend following the migration guide we've prepared to help you during this transition period:
      ${chalk.yellow('https://storybook.js.org/docs/writing-tests/storyshots-migration-guide')}
    `;
  },
};
