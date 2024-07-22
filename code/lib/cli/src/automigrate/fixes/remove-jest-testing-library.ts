import chalk from 'chalk';
import { dedent } from 'ts-dedent';
import type { Fix } from '../types';
import { getStorybookVersionSpecifier } from '../../helpers';
import { runCodemod } from '@storybook/codemod';
import prompts from 'prompts';

const logger = console;

export const removeJestTestingLibrary: Fix<{ incompatiblePackages: string[] }> = {
  id: 'remove-jest-testing-library',
  versionRange: ['<8.0.0-alpha.0', '>=8.0.0-alpha.0'],
  promptType: 'auto',
  async check({ packageManager }) {
    const deps = await packageManager.getAllDependencies();

    const incompatiblePackages = Object.keys(deps).filter(
      (it) => it === '@storybook/jest' || it === '@storybook/testing-library'
    );
    return incompatiblePackages.length ? { incompatiblePackages } : null;
  },
  prompt({ incompatiblePackages }) {
    return dedent`
      ${chalk.bold(
        'Attention'
      )}: We've detected that you're using the following packages which are known to be incompatible since Storybook 8:

      ${incompatiblePackages.map((name) => `- ${chalk.cyan(`${name}`)}`).join('\n')}

      We will uninstall them for you and install ${chalk.cyan('@storybook/test')} instead.

      Also, we can help you migrate your stories to use the new package.
    `;
  },
  async run({ packageManager, dryRun }) {
    if (!dryRun) {
      const packageJson = await packageManager.retrievePackageJson();

      await packageManager.removeDependencies({ skipInstall: true, packageJson }, [
        '@storybook/jest',
        '@storybook/testing-library',
      ]);

      const versionToInstall = getStorybookVersionSpecifier(packageJson);

      await packageManager.addDependencies({ installAsDevDependencies: true, packageJson }, [
        `@storybook/test@${versionToInstall}`,
      ]);

      const { glob: globString } = await prompts({
        type: 'text',
        name: 'glob',
        message: 'Please enter the glob for your stories to migrate to @storybook/test',
        initial: './src/**/*.stories.*',
      });

      if (globString) {
        await runCodemod('migrate-to-test-package', { glob: globString, dryRun, logger });
      }
    }
  },
};
