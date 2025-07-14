/* eslint-disable local-rules/no-uncategorized-errors */
import type { JsPackageManager } from 'storybook/internal/common';
import { versions as storybookCorePackages } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import semver from 'semver';

import { consolidatedPackages } from '../automigrate/helpers/consolidated-packages';

export type AnalysedPackage = {
  packageName: string;
  packageVersion?: string;
  homepage?: string;
  hasIncompatibleDependencies?: boolean;
  availableUpdate?: string;
  availableCoreUpdate?: string;
  packageStorybookVersion?: string;
};

type Context = {
  currentStorybookVersion: string;
  packageManager: JsPackageManager;
  skipUpgradeCheck?: boolean;
  skipErrors?: boolean;
};

/**
 * Determines if a package is part of the Storybook monorepo and should be checked for
 * compatibility. External packages (community addons) should not be subject to this compatibility
 * check.
 */
const isMonorepoPackage = (packageName: string): boolean => {
  // If it's a core package, it's definitely part of the monorepo
  if (storybookCorePackages[packageName as keyof typeof storybookCorePackages]) {
    return true;
  }

  // Check if it's a legacy consolidated package that's part of the monorepo
  if (consolidatedPackages[packageName as keyof typeof consolidatedPackages]) {
    return true;
  }

  // These are official Storybook packages that are part of the monorepo
  // but may not be in the current versions list
  const monorepoPackagePatterns = [
    /^@storybook\/addon-(a11y|docs|jest|links|onboarding|themes|vitest)$/,
    /^@storybook\/builder-(vite|webpack5)$/,
    /^@storybook\/(angular|ember|html|nextjs|preact|react|server|svelte|vue3|web-components)(-vite|-webpack5)?$/,
    /^@storybook\/preset-(create-react-app|react-webpack|server-webpack)$/,
    /^@storybook\/(cli|codemod|core-webpack|csf-plugin|react-dom-shim)$/,
    /^(storybook|sb|create-storybook|storybook-addon-pseudo-states|eslint-plugin-storybook)$/,
  ];

  return monorepoPackagePatterns.some((pattern) => pattern.test(packageName));
};

export const checkPackageCompatibility = async (
  dependency: string,
  context: Context
): Promise<AnalysedPackage> => {
  const { currentStorybookVersion, skipErrors, packageManager } = context;
  try {
    const dependencyPackageJson = packageManager.getModulePackageJSON(dependency);
    if (dependencyPackageJson === null) {
      return { packageName: dependency };
    }

    const {
      version: packageVersion,
      name = dependency,
      dependencies,
      peerDependencies,
      homepage,
    } = dependencyPackageJson;

    const packageStorybookVersion = Object.entries({
      ...dependencies,
      ...peerDependencies,
    })
      .filter(
        ([dep]) =>
          storybookCorePackages[dep as keyof typeof storybookCorePackages] ||
          consolidatedPackages[dep as keyof typeof consolidatedPackages]
      )
      .map(([_, versionRange]) => versionRange)
      .find((versionRange) => {
        // prevent issues with "tag" based versions e.g. "latest" or "next" instead of actual numbers
        return (
          versionRange &&
          semver.validRange(versionRange) &&
          !semver.satisfies(currentStorybookVersion, versionRange)
        );
      });

    const isCorePackage = storybookCorePackages[name as keyof typeof storybookCorePackages];

    let availableUpdate;
    let availableCoreUpdate;

    // For now, we notify about updates only for core packages (which will match the currently installed storybook version)
    // In the future, we can use packageManager.latestVersion(name, constraint) for all packages
    if (isCorePackage && packageVersion && semver.gt(currentStorybookVersion, packageVersion)) {
      availableUpdate = currentStorybookVersion;
    }

    // If the package is greater than the current version, this means a core update is available.
    if (isCorePackage && packageVersion && semver.gt(packageVersion, currentStorybookVersion)) {
      availableCoreUpdate = packageVersion;
    }

    return {
      packageName: name,
      packageVersion,
      homepage,
      hasIncompatibleDependencies: packageStorybookVersion != null,
      packageStorybookVersion,
      availableUpdate,
      availableCoreUpdate,
    };
  } catch (err) {
    if (!skipErrors) {
      logger.log(
        `Error checking compatibility for ${dependency}, please report an issue:\n` + String(err)
      );
    }
    return { packageName: dependency };
  }
};

export const getIncompatibleStorybookPackages = async (
  context: Context
): Promise<AnalysedPackage[]> => {
  const allDeps = context.packageManager.getAllDependencies();
  const storybookLikeDeps = Object.keys(allDeps).filter((dep) => dep.includes('storybook'));
  if (storybookLikeDeps.length === 0 && !context.skipErrors) {
    throw new Error('No Storybook dependencies found in the package.json');
  }
  return Promise.all(
    storybookLikeDeps
      .filter((dep) => !storybookCorePackages[dep as keyof typeof storybookCorePackages])
      .filter(isMonorepoPackage) // Only check packages that are part of the monorepo
      .map((dep) => checkPackageCompatibility(dep, context))
  );
};

export const getIncompatiblePackagesSummary = (
  dependencyAnalysis: AnalysedPackage[],
  currentStorybookVersion: string
) => {
  const summaryMessage: string[] = [];

  const incompatiblePackages = dependencyAnalysis.filter(
    (dep) => dep.hasIncompatibleDependencies
  ) as AnalysedPackage[];

  if (incompatiblePackages.length > 0) {
    summaryMessage.push(
      `You are currently using Storybook ${picocolors.bold(
        currentStorybookVersion
      )} but you have packages which are incompatible with it:\n`
    );
    incompatiblePackages.forEach(
      ({
        packageName: addonName,
        packageVersion: addonVersion,
        homepage,
        availableUpdate,
        packageStorybookVersion,
      }) => {
        const packageDescription = `${addonName}@${addonVersion}`;
        const updateMessage = availableUpdate ? ` (${availableUpdate} available!)` : '';
        const dependsOnStorybook =
          packageStorybookVersion != null ? ` which depends on ${packageStorybookVersion}` : '';
        const packageRepo = homepage ? `\n Repo: ${homepage}` : '';

        summaryMessage.push(
          `- ${packageDescription}${updateMessage}${dependsOnStorybook}${packageRepo}`
        );
      }
    );

    summaryMessage.push(
      '\nPlease consider updating your packages or contacting the maintainers for compatibility details.',
      '\nFor more on Storybook 9 compatibility, see the linked GitHub issue:',
      'https://github.com/storybookjs/storybook/issues/30944'
    );

    if (incompatiblePackages.some((dep) => dep.availableCoreUpdate)) {
      summaryMessage.push(
        '\n',
        `The version of ${picocolors.blue(`storybook@${currentStorybookVersion}`)} is behind the following core packages:`,
        `${incompatiblePackages
          .filter((dep) => dep.availableCoreUpdate)
          .map(
            ({ packageName, packageVersion }) =>
              `- ${picocolors.blue(`${packageName}@${packageVersion}`)}`
          )
          .join('\n')}`,
        '\n',
        `Upgrade Storybook with:`,
        picocolors.blue('npx storybook@latest upgrade')
      );
    }
  }

  return summaryMessage.join('\n');
};
