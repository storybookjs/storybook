import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { PackageJson } from 'storybook/internal/common';
import type { JsPackageManager } from 'storybook/internal/common';
import { isCorePackage, isSatelliteAddon } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { gt } from 'semver';
import { dedent } from 'ts-dedent';

import { getIncompatibleStorybookPackages } from '../../doctor/getIncompatibleStorybookPackages';
import type { Fix } from '../types';

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
      beforeVersion: await packageManager.getInstalledVersion(packageName),
      afterVersion: await packageManager.latestVersion(packageName),
    }))
  );
}

/** Filter out dependencies that are not valid e.g. yarn patches, git urls and other protocols */
function isValidVersionType(packageName: string, specifier: string) {
  if (
    specifier.startsWith('patch:') ||
    specifier.startsWith('file:') ||
    specifier.startsWith('link:') ||
    specifier.startsWith('portal:') ||
    specifier.startsWith('git:') ||
    specifier.startsWith('git+') ||
    specifier.startsWith('http:') ||
    specifier.startsWith('https:') ||
    specifier.startsWith('workspace:')
  ) {
    logger.debug(`Skipping ${packageName} as it does not have a valid version type: ${specifier}`);
    return false;
  }

  return true;
}

/**
 * Is the user upgrading to the `latest` version of Storybook? Let's try to pull along some of the
 * storybook related dependencies to `latest` as well!
 *
 * We communicate clearly that this migration is a helping hand, but not a complete solution. The
 * user should still manually check for other dependencies that might be incompatible.
 *
 * See: https://github.com/storybookjs/storybook/issues/25731#issuecomment-1977346398
 */
export const upgradeStorybookRelatedDependencies = {
  id: 'upgrade-storybook-related-dependencies',
  promptType: 'auto',
  defaultSelected: false,

  async check({ packageManager, storybookVersion }) {
    logger.debug('Checking for incompatible storybook packages...');
    const analyzedPackages = await getIncompatibleStorybookPackages({
      currentStorybookVersion: storybookVersion,
      packageManager,
      skipErrors: true,
    });

    const allDependencies = packageManager.getAllDependencies();

    const storybookDependencies = Object.keys(allDependencies)
      .filter((dep) => dep.includes('storybook'))
      .filter((dep) => !isCorePackage(dep) && !isSatelliteAddon(dep));

    const incompatibleDependencies = analyzedPackages
      .filter((pkg) => pkg.hasIncompatibleDependencies)
      .map((pkg) => pkg.packageName);

    const uniquePackages = Array.from(
      new Set(
        [...storybookDependencies, ...incompatibleDependencies].filter((dep) =>
          isValidVersionType(dep, allDependencies[dep])
        )
      )
    ).map((packageName) => [packageName, allDependencies[packageName]]) as [string, string][];

    const packageVersions = await getLatestVersions(packageManager, uniquePackages);
    const upgradablePackages = packageVersions.filter(
      ({ afterVersion, beforeVersion, packageName }) => {
        if (
          beforeVersion === null ||
          afterVersion === null ||
          allDependencies[packageName] === null
        ) {
          return false;
        }

        return gt(afterVersion, beforeVersion);
      }
    );

    return upgradablePackages.length > 0 ? { upgradable: upgradablePackages } : null;
  },

  prompt() {
    return "We'll upgrade the community packages that are compatible.";
  },

  async run({ result: { upgradable }, packageManager, dryRun }) {
    if (dryRun) {
      logger.log(dedent`
        The following would have been upgraded:
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
      packageManager.packageJsonPaths.forEach((packageJsonPath) => {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
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

        packageManager.writePackageJson(packageJson, dirname(packageJsonPath));
      });
    }
  },
} satisfies Fix<Options>;
