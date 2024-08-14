import chalk from 'chalk';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { checkWebpack5Builder } from '../helpers/checkWebpack5Builder';
import type { Fix } from '../types';
import { webpack5 } from './webpack5';

interface Vue3RunOptions {
  vueVersion: string;
  storybookVersion: string;
}

/**
 * Is the user upgrading to Vue3?
 *
 * If so:
 * - Run webpack5 fix
 */
export const vue3: Fix<Vue3RunOptions> = {
  id: 'vue3',

  versionRange: ['<7', '>=7'],

  async check({ packageManager, mainConfig, storybookVersion }) {
    const vueVersion = await packageManager.getPackageVersion('vue');

    if (!vueVersion || semver.lt(vueVersion, '3.0.0')) {
      return null;
    }

    const builderInfo = await checkWebpack5Builder({ mainConfig, storybookVersion });
    return builderInfo ? { vueVersion, ...builderInfo } : null;
  },

  prompt({ vueVersion, storybookVersion }) {
    const vueFormatted = chalk.cyan(`Vue ${vueVersion}`);
    const sbFormatted = chalk.cyan(`Storybook ${storybookVersion}`);
    return dedent`
      We've detected you are running ${vueFormatted} with Storybook.
      ${sbFormatted} runs webpack4 by default, which is incompatible.

      In order to work with your version of Vue, we need to install Storybook's ${chalk.cyan(
        'webpack5 builder'
      )}.

      More info: ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vue3-upgrade'
      )}
    `;
  },

  async run(options) {
    return webpack5.run({
      ...options,
      result: { webpackVersion: null, ...options.result },
    });
  },
};
