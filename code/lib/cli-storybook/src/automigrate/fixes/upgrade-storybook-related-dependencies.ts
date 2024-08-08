import { dedent } from 'ts-dedent';
import { cyan, yellow } from 'chalk';
import { gt } from 'semver';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCorePackage } from 'storybook/internal/common';
import type { Fix } from '../types';
import { getIncompatibleStorybookPackages } from '../../doctor/getIncompatibleStorybookPackages';

type PackageMetadata = {
  packageName: string;
  beforeVersion: string | null;
  afterVersion: string | null;
};

interface Options {
  upgradable: PackageMetadata[];
}

async function getLatestVersions(
  packageManager: JsPackageManager,
  packages: [string, string][]
): Promise<PackageMetadata[]> {
  return Promise.all(
    packages.map(async ([packageName]) => ({
      packageName,
      beforeVersion: await packageManager.getInstalledVersion(packageName).catch(() => null),
      afterVersion: await packageManager.latestVersion(packageName).catch(() => null),
    }))
  );
}

/**
 * Is the user upgrading to the `latest` version of Storybook?
 * Let's try to pull along some of the storybook related dependencies to `latest` as well!
 *
 * We communicate clearly that this migration is a helping hand, but not a complete solution.
 * The user should still manually check for other dependencies that might be incompatible.
 *
 * see: https://github.com/storybookjs/storybook/issues/25731#issuecomment-1977346398
 */
export const upgradeStorybookRelatedDependencies = {
  id: 'upgradeStorybookRelatedDependencies',
  versionRange: ['*.*.*', '*.*.*'],
  promptType: 'auto',
  promptDefaultValue: false,

  async check({ packageManager, storybookVersion }) {
    const analyzedPackages = await getIncompatibleStorybookPackages({
      currentStorybookVersion: storybookVersion,
      packageManager,
      skipErrors: true,
    });

    const allDependencies = (await packageManager.getAllDependencies()) as Record<string, string>;
    const storybookDependencies = Object.keys(allDependencies)
      .filter((dep) => dep.includes('storybook'))
      .filter((dep) => !isCorePackage(dep));
    const incompatibleDependencies = analyzedPackages
      .filter((pkg) => pkg.hasIncompatibleDependencies)
      .map((pkg) => pkg.packageName);

    const uniquePackages = Array.from(
      new Set([...storybookDependencies, ...incompatibleDependencies])
    ).map((packageName) => [packageName, allDependencies[packageName]]) as [string, string][];

    const packageVersions = await getLatestVersions(packageManager, uniquePackages);

    const upgradablePackages = packageVersions.filter(({ afterVersion, beforeVersion }) => {
      if (beforeVersion === null || afterVersion === null) {
        return false;
      }

      return gt(afterVersion, beforeVersion);
    });

    return upgradablePackages.length > 0 ? { upgradable: upgradablePackages } : null;
  },

  prompt({ upgradable }) {
    return dedent`
      You're upgrading to the latest version of Storybook. We recommend upgrading the following packages:
      ${upgradable
        .map(({ packageName, afterVersion, beforeVersion }) => {
          return `- ${cyan(packageName)}: ${cyan(beforeVersion)} => ${cyan(afterVersion)}`;
        })
        .join('\n')}

      After upgrading, we will run the dedupe command, which could possibly have effects on dependencies that are not Storybook related.
      see: https://docs.npmjs.com/cli/commands/npm-dedupe

      Do you want to proceed (upgrade the detected packages)?
    `;
  },

  async run({ result: { upgradable }, packageManager, dryRun }) {
    if (dryRun) {
      console.log(dedent`
        We would have upgrade the following:
        ${upgradable
          .map(
            ({ packageName, afterVersion, beforeVersion }) =>
              `${packageName}: ${beforeVersion} => ${afterVersion}`
          )
          .join('\n')}
      `);
      return;
    }

    if (upgradable.length > 0) {
      const packageJson = await packageManager.readPackageJson();

      upgradable.forEach((item) => {
        if (!item) {
          return;
        }

        const { packageName, afterVersion: version } = item;
        const prefixed = `^${version}`;

        if (packageJson.dependencies?.[packageName]) {
          packageJson.dependencies[packageName] = prefixed;
        }
        if (packageJson.devDependencies?.[packageName]) {
          packageJson.devDependencies[packageName] = prefixed;
        }
        if (packageJson.peerDependencies?.[packageName]) {
          packageJson.peerDependencies[packageName] = prefixed;
        }
      });

      await packageManager.writePackageJson(packageJson);
      await packageManager.installDependencies();

      await packageManager
        .executeCommand({ command: 'dedupe', args: [], stdio: 'ignore' })
        .catch(() => {});

      console.log();
      console.log(dedent`
        We upgraded ${yellow(upgradable.length)} packages:
        ${upgradable
          .map(({ packageName, afterVersion, beforeVersion }) => {
            return `- ${cyan(packageName)}: ${cyan(beforeVersion)} => ${cyan(afterVersion)}`;
          })
          .join('\n')}
        `);
    }
    console.log();
  },
} satisfies Fix<Options>;
