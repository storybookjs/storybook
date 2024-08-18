import {
  SUPPORTED_ESLINT_EXTENSIONS,
  configureEslintPlugin,
  extractEslintInfo,
  findEslintFile,
} from 'storybook/internal/cli';

import chalk from 'chalk';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const logger = console;

interface EslintPluginRunOptions {
  eslintFile: string;
  unsupportedExtension?: string;
}

/**
 * Does the user not have eslint-plugin-storybook installed?
 *
 * If so:
 *
 * - Install it, and if possible configure it
 */
export const eslintPlugin: Fix<EslintPluginRunOptions> = {
  id: 'eslintPlugin',

  versionRange: ['<8', '>=7'],

  async check({ packageManager }) {
    const { hasEslint, isStorybookPluginInstalled } = await extractEslintInfo(packageManager);

    if (isStorybookPluginInstalled || !hasEslint) {
      return null;
    }

    let eslintFile: string | null = null;
    let unsupportedExtension: string | undefined;
    try {
      eslintFile = findEslintFile();
    } catch (err) {
      unsupportedExtension = String(err);
    }

    if (!eslintFile || !unsupportedExtension) {
      logger.warn('Unable to find .eslintrc config file, skipping');
      return null;
    }

    return { eslintFile, unsupportedExtension };
  },

  prompt() {
    return dedent`
      We've detected you are not using our eslint-plugin.

      In order to have the best experience with Storybook and follow best practices, we advise you to install eslint-plugin-storybook.

      More info: ${chalk.yellow('https://github.com/storybookjs/eslint-plugin-storybook#readme')}
    `;
  },

  async run({ result: { eslintFile, unsupportedExtension }, packageManager, dryRun, skipInstall }) {
    const deps = [`eslint-plugin-storybook`];

    logger.info(`✅ Adding dependencies: ${deps}`);
    if (!dryRun) {
      await packageManager.addDependencies({ installAsDevDependencies: true, skipInstall }, deps);
    }

    if (!dryRun && unsupportedExtension) {
      logger.info(dedent`
          ⚠️ The plugin was successfully installed but failed to configure.
          
          Found an eslint config file with an unsupported automigration format: .eslintrc.${unsupportedExtension}.
          The supported formats for this automigration are: ${SUPPORTED_ESLINT_EXTENSIONS.join(
            ', '
          )}.

          Please refer to https://github.com/storybookjs/eslint-plugin-storybook#usage to finish setting up the plugin manually.
      `);
      return;
    }

    if (!dryRun) {
      await configureEslintPlugin(eslintFile, packageManager);
    }
  },
};
