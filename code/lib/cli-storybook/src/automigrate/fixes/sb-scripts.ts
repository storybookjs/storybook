import chalk from 'chalk';
import { dedent } from 'ts-dedent';
import semver from 'semver';
import type { PackageJson } from 'storybook/internal/types';
import type { Fix } from '../types';
import type { PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';

interface SbScriptsRunOptions {
  storybookScripts: Record<string, { before: string; after: string }>;
  storybookVersion: string;
  packageJson: PackageJsonWithDepsAndDevDeps;
}

const logger = console;

/**
 * Slightly big function because JS regex doesn't have proper full-word boundary.
 * This goes through all the words in each script, and only return the scripts
 * that do contain the actual sb binary, and not something like "npm run start-storybook"
 * which could actually be a custom script even though the name matches the legacy binary name
 */
export const getStorybookScripts = (allScripts: NonNullable<PackageJson['scripts']>) => {
  return Object.keys(allScripts).reduce(
    (acc, key) => {
      const currentScript = allScripts[key];
      if (currentScript == null) {
        return acc;
      }
      let isStorybookScript = false;
      const allWordsFromScript = currentScript.split(' ');
      const newScript = allWordsFromScript
        .map((currentWord, index) => {
          const previousWord = allWordsFromScript[index - 1];

          // full word check, rather than regex which could be faulty
          const isSbBinary =
            currentWord === 'build-storybook' ||
            currentWord === 'start-storybook' ||
            currentWord === 'sb';

          // in case people have scripts like `yarn start-storybook`
          const isPrependedByPkgManager =
            previousWord &&
            ['npx', 'run', 'yarn', 'pnpx', 'pnpm dlx'].some((cmd) => previousWord.includes(cmd));

          if (isSbBinary && !isPrependedByPkgManager) {
            isStorybookScript = true;
            return currentWord
              .replace('sb', 'storybook')
              .replace('start-storybook', 'storybook dev')
              .replace('build-storybook', 'storybook build');
          }

          return currentWord;
        })
        .join(' ');

      if (isStorybookScript) {
        acc[key] = {
          before: currentScript,
          after: newScript,
        };
      }

      return acc;
    },
    {} as Record<string, { before: string; after: string }>
  );
};

/**
 * Is the user using start-storybook or build-storybook in its scripts
 *
 * If so:
 * - Change start-storybook and build-storybook scripts to storybook dev and storybook build
 * - Change sb to storybook if they are using sb
 */
export const sbScripts: Fix<SbScriptsRunOptions> = {
  id: 'sb-scripts',

  versionRange: ['*', '*'],

  async check({ packageManager, storybookVersion }) {
    const packageJson = await packageManager.retrievePackageJson();
    const { scripts = {} } = packageJson;

    if (semver.lt(storybookVersion, '7.0.0')) {
      return null;
    }

    const storybookScripts = getStorybookScripts(scripts);

    if (Object.keys(storybookScripts).length === 0) {
      return null;
    }

    return { packageJson, storybookScripts, storybookVersion };
  },

  prompt({ storybookVersion, storybookScripts }) {
    const sbFormatted = chalk.cyan(`Storybook ${storybookVersion}`);

    const newScriptsMessage = Object.keys(storybookScripts).reduce((acc: string[], scriptKey) => {
      acc.push(
        [
          chalk.bold(scriptKey),
          'from:',
          chalk.cyan(storybookScripts[scriptKey].before),
          'to:',
          chalk.cyan(storybookScripts[scriptKey].after),
        ].join('\n')
      );
      return acc;
    }, []);

    return dedent`
      We've detected you are using ${sbFormatted} with scripts from previous versions of Storybook.
      Starting in Storybook 7, the ${chalk.yellow('start-storybook')} and ${chalk.yellow(
        'build-storybook'
      )} binaries have changed to ${chalk.magenta('storybook dev')} and ${chalk.magenta(
        'storybook build'
      )} respectively.
      In order to work with ${sbFormatted}, your storybook scripts have to be adjusted to use the binary. We can adjust them for you:

      ${newScriptsMessage.join('\n\n')}

      In case this migration did not cover all of your scripts, or you'd like more info: ${chalk.yellow(
        'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#start-storybook--build-storybook-binaries-removed'
      )}
      `;
  },

  async run({ result: { storybookScripts }, packageManager, dryRun }) {
    logger.info(`✅ Updating scripts in package.json`);
    logger.log();
    if (!dryRun) {
      const newScripts = Object.keys(storybookScripts).reduce(
        (acc, scriptKey) => {
          acc[scriptKey] = storybookScripts[scriptKey].after;
          return acc;
        },
        {} as Record<string, string>
      );

      logger.log();

      await packageManager.addScripts(newScripts);
    }
  },
};
