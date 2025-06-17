import chalk from 'chalk';
import { dedent } from 'ts-dedent';
import semver from 'semver';
import type { Fix } from '../types';
import { checkWebpack5Builder } from '../helpers/checkWebpack5Builder';
import { updateMainConfig } from '../helpers/mainConfigFile';

const logger = console;

interface Webpack5RunOptions {
  webpackVersion: string | null;
  storybookVersion: string;
}

/**
 * Is the user using webpack5 in their project?
 *
 * If the user is using a version of SB >= 6.3,
 * prompt them to upgrade to webpack5.
 *
 * - Add manager-webpack5 builder-webpack5 as dev dependencies
 * - Add core.builder = 'webpack5' to main.js
 * - Add 'webpack5' as a project dependency
 */
export const webpack5 = {
  id: 'webpack5',

  versionRange: ['<7', '>=7'],

  async check({ packageManager, mainConfig, storybookVersion }) {
    const webpackVersion = await packageManager.getPackageVersion('webpack');

    if (
      !webpackVersion ||
      semver.lt(webpackVersion, '5.0.0') ||
      semver.gte(webpackVersion, '6.0.0')
    )
      return null;

    const builderInfo = await checkWebpack5Builder({ mainConfig, storybookVersion });
    return builderInfo ? { webpackVersion, ...builderInfo } : null;
  },

  prompt({ webpackVersion }) {
    const webpackFormatted = chalk.cyan(`webpack ${webpackVersion}`);

    return dedent`
      We've detected you're running ${webpackFormatted}.
      Your Storybook's main.js files specifies webpack4, which is incompatible.
      
      To run Storybook in webpack5-mode, we can install Storybook's ${chalk.cyan(
        '@storybook/builder-webpack5'
      )} for you.

      More info: ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#webpack-5-manager-build'
      )}
    `;
  },

  async run({
    result: { storybookVersion, webpackVersion },
    packageManager,
    dryRun,
    mainConfigPath,
  }) {
    const deps = [`@storybook/builder-webpack5@${storybookVersion}`];
    // this also gets called by 'cra5' fix so we need to add
    // webpack5 at the project root so that it gets hoisted
    if (!webpackVersion) {
      deps.push('webpack@5');
    }
    logger.info(`✅ Adding dependencies: ${deps}`);
    if (!dryRun) {
      await packageManager.addDependencies({ installAsDevDependencies: true }, deps);
    }

    logger.info('✅ Setting `core.builder` to `@storybook/builder-webpack5` in main.js');
    if (!dryRun) {
      await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
        main.setFieldValue(['core', 'builder'], '@storybook/builder-webpack5');
      });
    }
  },
} satisfies Fix<Webpack5RunOptions>;
