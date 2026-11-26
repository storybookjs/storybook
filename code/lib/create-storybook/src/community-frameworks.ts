import {
  type JsPackageManager,
  frameworkPackages,
  getPackageDetails,
  versions,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { gt, prerelease } from 'semver';

/**
 * Packages that `storybook init` installs but that are versioned and released outside this
 * monorepo. They are installed by dist-tag rather than by the CLI version: `latest` for a stable
 * Storybook, `next` for a Storybook prerelease when the framework publishes one (see
 * `communityPackageSpecifier`).
 *
 * The framework packages are derived from `frameworkPackages`, so a community framework only needs
 * to be registered there. Packages installed in place of a framework package are listed explicitly.
 */
export const COMMUNITY_FRAMEWORK_PACKAGES: readonly string[] = [
  ...Object.keys(frameworkPackages).filter((packageName) => !(packageName in versions)),
  // The Nuxt generator installs the Nuxt module, which depends on `@storybook-vue/nuxt`.
  '@nuxtjs/storybook',
];

export function isCommunityFrameworkPackage(packageName: string): boolean {
  return COMMUNITY_FRAMEWORK_PACKAGES.includes(packageName);
}

/**
 * Picks the dist-tag to install a community framework package from, for the given Storybook
 * version.
 *
 * A stable Storybook installs `latest`. A Storybook prerelease (alpha, beta, rc) installs `next`
 * when the package publishes that tag and it points to a newer version than `latest`; otherwise it
 * falls back to `latest`. A `next` tag that is older than `latest` is a leftover from a previous
 * prerelease cycle, not a build for the current one.
 */
export async function communityFrameworkDistTag(
  packageManager: Pick<JsPackageManager, 'latestVersion'>,
  packageName: string,
  storybookVersion: string
): Promise<'next' | 'latest'> {
  if (!prerelease(storybookVersion)) {
    return 'latest';
  }

  const nextVersion = await packageManager.latestVersion(`${packageName}@next`);
  if (!nextVersion) {
    logger.debug(
      `${packageName} has no next dist-tag for Storybook ${storybookVersion}, installing latest instead`
    );
    return 'latest';
  }

  const latestVersion = await packageManager.latestVersion(packageName);
  if (latestVersion && !gt(nextVersion, latestVersion)) {
    logger.debug(
      `${packageName}@next (${nextVersion}) is not newer than latest (${latestVersion}), installing latest instead`
    );
    return 'latest';
  }

  return 'next';
}

/**
 * Returns the install specifier for a package collected by a generator. Community framework
 * packages requested without a version get the dist-tag chosen by `communityFrameworkDistTag`;
 * every other package is returned unchanged.
 */
export async function communityPackageSpecifier(
  packageManager: Pick<JsPackageManager, 'latestVersion'>,
  pkg: string,
  storybookVersion: string = versions.storybook
): Promise<string> {
  const [packageName, requestedVersion] = getPackageDetails(pkg);
  if (requestedVersion || !isCommunityFrameworkPackage(packageName)) {
    return pkg;
  }

  const tag = await communityFrameworkDistTag(packageManager, packageName, storybookVersion);
  return tag === 'latest' ? packageName : `${packageName}@${tag}`;
}
