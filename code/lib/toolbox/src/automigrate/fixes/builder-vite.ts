import chalk from 'chalk';
import { dedent } from 'ts-dedent';

import { writeConfig } from '@storybook/core/csf-tools';

import type { Fix } from '../types';
import type { PackageJson } from '@storybook/core/types';
import { updateMainConfig } from '../helpers/mainConfigFile';
import { getStorybookVersionSpecifier } from '../../helpers';

const logger = console;

interface BuilderViteOptions {
  builder: any;
  packageJson: PackageJson;
}

/**
 * Is the user using 'storybook-builder-vite' in their project?
 *
 * If so, prompt them to upgrade to '@storybook/builder-vite'.
 *
 * - Add '@storybook/builder-vite' as dev dependency
 * - Remove 'storybook-builder-vite' dependency
 * - Add core.builder = '@storybook/builder-vite' to main.js
 */
export const builderVite: Fix<BuilderViteOptions> = {
  id: 'builder-vite',

  versionRange: ['<7', '>=7'],

  async check({ packageManager, mainConfig }) {
    const packageJson = await packageManager.retrievePackageJson();
    const builder = mainConfig.core?.builder;
    const builderName = typeof builder === 'string' ? builder : builder?.name;

    if (builderName !== 'storybook-builder-vite') {
      return null;
    }

    return { builder, packageJson };
  },

  prompt({ builder }) {
    const builderFormatted = chalk.cyan(JSON.stringify(builder, null, 2));

    return dedent`
      We've detected you're using the community vite builder: ${builderFormatted}
      
      'storybook-builder-vite' is deprecated and now located at ${chalk.cyan(
        '@storybook/builder-vite'
      )}.

      We can upgrade your project to use the new builder automatically.
      
      More info: ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#vite-builder-renamed'
      )}
    `;
  },

  async run({ result: { builder, packageJson }, packageManager, dryRun, mainConfigPath }) {
    const { dependencies = {}, devDependencies = {} } = packageJson;

    logger.info(`✅ Removing existing 'storybook-builder-vite' dependency`);
    if (!dryRun) {
      delete dependencies['storybook-builder-vite'];
      delete devDependencies['storybook-builder-vite'];
      await packageManager.writePackageJson(packageJson);
    }

    logger.info(`✅ Adding '@storybook/builder-vite' as dev dependency`);
    if (!dryRun) {
      const versionToInstall = getStorybookVersionSpecifier(
        await packageManager.retrievePackageJson()
      );
      await packageManager.addDependencies({ installAsDevDependencies: true }, [
        `@storybook/builder-vite@${versionToInstall}`,
      ]);
    }

    logger.info(`✅ Updating main.js to use vite builder`);
    if (!dryRun) {
      await updateMainConfig({ dryRun: !!dryRun, mainConfigPath }, async (main) => {
        const updatedBuilder =
          typeof builder === 'string'
            ? '@storybook/builder-vite'
            : { name: '@storybook/builder-vite', options: builder.options };
        main.setFieldValue(['core', 'builder'], updatedBuilder);
        await writeConfig(main);
      });
    }
  },
};
