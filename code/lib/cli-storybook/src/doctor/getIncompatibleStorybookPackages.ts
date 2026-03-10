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

export const checkPackageCompatibility = async (
  dependency: string,
  context: Context
): Promise<AnalysedPackage> => {
  const { currentStorybookVersion, skipErrors, packageManager } = context;
  try {
    const dependencyPackageJson = await packageManager.getModulePackageJSON(dependency);
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
          // We can't check compatibility for 0.x packages, so we skip them
          !/^[~^]?0\./.test(versionRange) &&
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
  if (context.currentStorybookVersion.includes('0.0.0')) {
    // We can't know if a Storybook canary version is compatible with other packages, so we skip it
    return [];
  }

  const allDeps = context.packageManager.getAllDependencies();
  const storybookLikeDeps = Object.keys(allDeps).filter((dep) => dep.includes('storybook'));
  if (storybookLikeDeps.length === 0 && !context.skipErrors) {
    throw new Error('No Storybook dependencies found in the package.json');
  }
  return Promise.all(
    storybookLikeDeps
      .filter((dep) => !storybookCorePackages[dep as keyof typeof storybookCorePackages])
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
      '\nFor more details on compatibility guidance, see:',
      'https://github.com/storybookjs/storybook/issues/32836'
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
