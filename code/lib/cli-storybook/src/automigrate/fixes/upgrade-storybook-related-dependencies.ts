import { dirname } from 'node:path';

import { JsPackageManager, isCorePackage, isSatelliteAddon } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { gt } from 'semver';

import { getIncompatibleStorybookPackages } from '../../doctor/getIncompatibleStorybookPackages.ts';
import type { Fix } from '../types.ts';

type PackageMetadata = {
  packageName: string;
  beforeVersion: string;
  afterVersion: string;
};

// Yarn patches, local paths, git and URL specifiers, and workspaces have no registry version to bump.
const NON_REGISTRY_SPECIFIER = /^(patch|file|link|portal|git|http|https|workspace):|^git\+/;

// Scopes whose packages are released in lockstep and must share a major version.
const LOCKSTEP_SCOPES = new Set(['@nx']);

const scopeOf = (packageName: string) =>
  packageName.startsWith('@') ? packageName.slice(0, packageName.indexOf('/')) : null;

// A helping hand when upgrading to `latest`, not a complete solution: the user still has to check
// other dependencies. See https://github.com/storybookjs/storybook/issues/25731#issuecomment-1977346398
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

    const storybookDependencies = Object.keys(allDependencies).filter(
      (dep) => dep.includes('storybook') && !isCorePackage(dep) && !isSatelliteAddon(dep)
    );

    const incompatibleDependencies = analyzedPackages
      .filter((pkg) => pkg.hasIncompatibleDependencies)
      .map((pkg) => pkg.packageName);

    const packageNames = new Set(
      [...storybookDependencies, ...incompatibleDependencies].filter((dep) => {
        const specifier = allDependencies[dep];
        if (specifier !== undefined && !NON_REGISTRY_SPECIFIER.test(specifier)) {
          return true;
        }
        logger.debug(`Skipping ${dep}: it is not declared with a registry version (${specifier})`);
        return false;
      })
    );

    // A package from a lockstep scope whose siblings stay behind, like `@nx/storybook` next to
    // `@nx/web`, keeps its major version: a new major would fall out of step with them.
    const scopesStayingBehind = new Set(
      Object.keys(allDependencies)
        .filter((dependency) => !packageNames.has(dependency))
        .map(scopeOf)
        .filter((scope) => scope !== null && LOCKSTEP_SCOPES.has(scope))
    );
    const packageVersions = await Promise.all(
      [...packageNames].map(async (packageName) => {
        const beforeVersion = await packageManager.getInstalledVersion(packageName);
        const keepMajor = !!beforeVersion && scopesStayingBehind.has(scopeOf(packageName));
        return {
          packageName,
          beforeVersion,
          afterVersion: await packageManager.latestVersion(
            packageName,
            keepMajor ? `^${beforeVersion}` : undefined
          ),
        };
      })
    );
    const upgradable = packageVersions.filter(
      (pkg): pkg is PackageMetadata =>
        pkg.beforeVersion !== null &&
        pkg.afterVersion !== null &&
        gt(pkg.afterVersion, pkg.beforeVersion)
    );

    return upgradable.length > 0 ? { upgradable } : null;
  },

  prompt() {
    return "We'll upgrade the community packages that are compatible.";
  },

  async run({ result: { upgradable }, packageManager }) {
    for (const packageJsonPath of packageManager.packageJsonPaths) {
      const packageJson = JsPackageManager.getPackageJson(packageJsonPath);
      for (const { packageName, afterVersion } of upgradable) {
        for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
          if (packageJson[field]?.[packageName]) {
            packageJson[field][packageName] = `^${afterVersion}`;
          }
        }
      }
      packageManager.writePackageJson(packageJson, dirname(packageJsonPath));
    }
  },
} satisfies Fix<{ upgradable: PackageMetadata[] }>;
