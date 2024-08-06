import chalk from 'chalk';
import semver from 'semver';
import { dedent } from 'ts-dedent';
import type { StorybookConfigRaw } from 'storybook/internal/types';
import { getBuilderPackageName } from './mainConfigFile';

const logger = console;

export const checkWebpack5Builder = async ({
  mainConfig,
  storybookVersion,
}: {
  mainConfig: StorybookConfigRaw;
  storybookVersion: string;
}) => {
  if (semver.lt(storybookVersion, '6.3.0')) {
    logger.warn(
      dedent`
        Detected SB 6.3 or below, please upgrade storybook to use webpack5.

        To upgrade to the latest stable release, run this from your project directory:

        ${chalk.cyan('npx storybook@latest upgrade')}

        To upgrade to the latest pre-release, run this from your project directory:

        ${chalk.cyan('npx storybook@next upgrade')}
      `.trim()
    );
    return null;
  }

  if (semver.gte(storybookVersion, '7.0.0')) {
    return null;
  }

  if (!mainConfig) {
    logger.warn('Unable to find storybook main.js config');
    return null;
  }

  const builderPackageName = getBuilderPackageName(mainConfig);
  if (builderPackageName && builderPackageName !== 'webpack4') {
    logger.info(`Found builder ${builderPackageName}, skipping`);
    return null;
  }

  return { storybookVersion };
};
