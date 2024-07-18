import chalk from 'chalk';
import { readFile } from 'node:fs/promises';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';
import { getStorybookVersionSpecifier } from '../../helpers';
import type { InstallationMetadata, JsPackageManager } from '@storybook/core/common';

const logger = console;

type PackageUsage = Record<string, string[]>;

interface MissingStorybookDependenciesOptions {
  packageUsage: PackageUsage;
}

const consolidatedPackages = [
  '@storybook/channels',
  '@storybook/client-logger',
  '@storybook/core-common',
  '@storybook/core-events',
  '@storybook/csf-tools',
  '@storybook/docs-tools',
  '@storybook/node-logger',
  '@storybook/preview-api',
  '@storybook/router',
  '@storybook/telemetry',
  '@storybook/theming',
  '@storybook/types',
  '@storybook/manager-api',
  '@storybook/manager',
  '@storybook/preview',
  '@storybook/core-server',
  '@storybook/builder-manager',
  '@storybook/components',
];

async function checkInstallations(
  packageManager: JsPackageManager,
  packages: string[]
): Promise<InstallationMetadata['dependencies']> {
  let result: Record<string, any> = {};

  // go through each package and get installation info at depth 0 to make sure
  // the dependency is directly installed, else they could come from other dependencies
  const promises = packages.map((pkg) => packageManager.findInstallations([pkg], { depth: 0 }));

  const analyses = await Promise.all(promises);

  analyses.forEach((analysis) => {
    if (analysis?.dependencies) {
      result = {
        ...result,
        ...analysis.dependencies,
      };
    }
  });

  return result;
}

/**
 * Find usage of Storybook packages in the project files which are not present in the dependencies.
 */
export const missingStorybookDependencies: Fix<MissingStorybookDependenciesOptions> = {
  id: 'missingStorybookDependencies',
  promptType: 'auto',
  versionRange: ['<8.2', '>=8.2'],

  async check({ packageManager }) {
    // Dynamically import globby because it is a pure ESM module
    const { globby } = await import('globby');

    const result = await checkInstallations(packageManager, consolidatedPackages);
    if (!result) {
      return null;
    }

    const installedDependencies = Object.keys(result).sort();
    const dependenciesToCheck = consolidatedPackages.filter(
      (pkg) => !installedDependencies.includes(pkg)
    );

    const patterns = ['**/.storybook/*', '**/*.stories.*', '**/*.story.*'];

    const files = await globby(patterns, {
      ignore: ['**/node_modules/**'],
    });
    const packageUsage: PackageUsage = {};

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      dependenciesToCheck.forEach((pkg) => {
        // match imports like @storybook/theming or @storybook/theming/create
        const regex = new RegExp(`['"]${pkg}(/[^'"]*)?['"]`);
        if (regex.test(content)) {
          if (!packageUsage[pkg]) {
            packageUsage[pkg] = [];
          }
          packageUsage[pkg].push(file);
        }
      });
    }

    return Object.keys(packageUsage).length > 0 ? { packageUsage } : null;
  },

  prompt({ packageUsage }) {
    return dedent`
      Found the following Storybook packages used in your project, but they are missing from your project dependencies:
      ${Object.entries(packageUsage)
        .map(
          ([pkg, files]) =>
            `- ${chalk.cyan(pkg)}: (${files.length} ${files.length === 1 ? 'file' : 'files'})`
        )
        .sort()
        .join('\n')}

      Referencing missing packages can cause your project to crash. We can automatically add them to your dependencies.

      More info: https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#failed-to-resolve-import-storybookx-error
    `;
  },

  async run({ result: { packageUsage }, dryRun, packageManager }) {
    logger.info(
      `✅ Installing the following packages as devDependencies: ${Object.keys(packageUsage)}`
    );
    if (!dryRun) {
      const dependenciesToInstall = Object.keys(packageUsage);
      const versionToInstall = getStorybookVersionSpecifier(
        await packageManager.retrievePackageJson()
      );

      const versionToInstallWithoutModifiers = versionToInstall?.replace(/[\^~]/, '');

      /**
       * WORKAROUND: necessary for the following scenario:
       * Storybook latest is currently at 8.2.2
       * User has all Storybook deps at ^8.2.1
       * We run e.g. npm install with the dependency@^8.2.1
       * The package.json will have ^8.2.1 but install 8.2.2
       * So we first install the exact version, then run code again
       * to write to package.json to add the caret back, but without running install
       */
      await packageManager.addDependencies(
        { installAsDevDependencies: true },
        dependenciesToInstall.map((pkg) => `${pkg}@${versionToInstallWithoutModifiers}`)
      );
      const packageJson = await packageManager.retrievePackageJson();
      await packageManager.addDependencies(
        { installAsDevDependencies: true, skipInstall: true, packageJson },
        dependenciesToInstall.map((pkg) => `${pkg}@${versionToInstall}`)
      );
    }
  },
};
