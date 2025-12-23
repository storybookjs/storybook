import {
  SUPPORTED_ESLINT_EXTENSIONS,
  configureEslintPlugin,
  extractEslintInfo,
} from 'storybook/internal/cli';
import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

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
  link: 'https://storybook.js.org/docs/configure/integration/eslint-plugin',

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

    if (!eslintConfigFile) {
      logger.warn('Unable to find eslint config file, skipping');
      return null;
    }
    return { eslintConfigFile, unsupportedExtension, isFlatConfig };
  },

  prompt() {
    return `We'll install and configure the Storybook ESLint plugin for you.`;
  },

  async run({
    result: { eslintConfigFile, unsupportedExtension, isFlatConfig },
    packageManager,
    dryRun,
    storybookVersion,
  }) {
    const deps = [`eslint-plugin-storybook@${storybookVersion}`];

    logger.debug(`Adding dependencies: ${deps}`);
    if (!dryRun) {
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, deps);
    }

    if (!dryRun && unsupportedExtension) {
      logger.warn(dedent`
          The plugin was successfully installed but failed to be configured.
          
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
