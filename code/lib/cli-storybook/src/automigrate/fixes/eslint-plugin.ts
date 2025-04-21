import {
  SUPPORTED_ESLINT_EXTENSIONS,
  configureEslintPlugin,
  extractEslintInfo,
} from 'storybook/internal/cli';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const logger = console;

interface EslintPluginRunOptions {
  eslintConfigFile: string;
  unsupportedExtension?: string;
  isFlatConfig: boolean;
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

  versionRange: ['*', '*'],

  async check({ packageManager }) {
    const {
      hasEslint,
      eslintConfigFile,
      isStorybookPluginInstalled,
      unsupportedExtension,
      isFlatConfig,
    } = await extractEslintInfo(packageManager);

    if (isStorybookPluginInstalled || !hasEslint) {
      return null;
    }
    if (!eslintConfigFile || !unsupportedExtension) {
      logger.warn('Unable to find eslint config file, skipping');
      return null;
    }

    return { eslintConfigFile, unsupportedExtension, isFlatConfig };
  },

  prompt() {
    return dedent`
      We've detected you are not using the Storybook ESLint plugin.

      In order to have the best experience with Storybook and follow best practices, we advise you to install eslint-plugin-storybook.

      We can set it up automatically for you.

      More info: ${picocolors.yellow(
        'https://storybook.js.org/docs/configure/integration/eslint-plugin'
      )}
    `;
  },

  async run({
    result: { eslintConfigFile, unsupportedExtension, isFlatConfig },
    packageManager,
    dryRun,
    skipInstall,
  }) {
    const deps = [`eslint-plugin-storybook`];

    logger.info(`✅ Adding dependencies: ${deps}`);
    if (!dryRun) {
      await packageManager.addDependencies({ installAsDevDependencies: true, skipInstall }, deps);
    }

    if (!dryRun && unsupportedExtension) {
      logger.info(dedent`
          ⚠️ The plugin was successfully installed but failed to be configured.
          
          Found an eslint config file with an unsupported automigration format: .eslintrc.${unsupportedExtension}.
          The supported formats for this automigration are: ${SUPPORTED_ESLINT_EXTENSIONS.join(
            ', '
          )}.

          Please refer to https://storybook.js.org/docs/configure/integration/eslint-plugin#configuration-eslintrc to finish setting up the plugin manually.
      `);
      return;
    }

    if (!dryRun) {
      await configureEslintPlugin({ eslintConfigFile, packageManager, isFlatConfig });
    }
  },
};
