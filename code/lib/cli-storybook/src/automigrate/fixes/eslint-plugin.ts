import {
  SUPPORTED_ESLINT_EXTENSIONS,
  configureEslintPlugin,
  extractEslintInfo,
} from 'storybook/internal/cli';
import { JsPackageManager } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { dirname } from 'pathe';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types.ts';

export const eslintPlugin: Fix<{
  eslintConfigFile: string;
  unsupportedExtension?: string;
  isFlatConfig: boolean;
}> = {
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
      logger.debug('Unable to find eslint config file, skipping');
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
    storybookVersion,
  }) {
    // The config file can live above the current package (findEslintFile walks up to the project
    // root). The plugin must be declared where that file resolves imports from, not in whichever
    // package.json the upgrade happened to start in.
    const configPackageJsonPath = find.up('package.json', { cwd: dirname(eslintConfigFile) });
    await packageManager.addDependencies(
      {
        type: 'devDependencies',
        skipInstall: true,
        packageJsonInfo: configPackageJsonPath
          ? JsPackageManager.getPackageJsonInfo(configPackageJsonPath)
          : packageManager.primaryPackageJson,
      },
      [`eslint-plugin-storybook@${storybookVersion}`]
    );

    if (unsupportedExtension) {
      logger.warn(dedent`
          The plugin was successfully installed but failed to be configured.
          
          Found an eslint config file with an unsupported automigration format: .eslintrc.${unsupportedExtension}.
          The supported formats for this automigration are: ${SUPPORTED_ESLINT_EXTENSIONS.join(', ')}.

          Please refer to https://storybook.js.org/docs/configure/integration/eslint-plugin#configuration-eslintrc to finish setting up the plugin manually.
      `);
      return;
    }

    await configureEslintPlugin({ eslintConfigFile, packageManager, isFlatConfig });
  },
};
