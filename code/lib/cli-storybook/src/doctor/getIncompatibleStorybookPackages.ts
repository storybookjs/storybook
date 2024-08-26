/* eslint-disable local-rules/no-uncategorized-errors */
import type { JsPackageManager } from 'storybook/internal/common';
import {
  JsPackageManagerFactory,
  versions as storybookCorePackages,
} from 'storybook/internal/common';

import chalk from 'chalk';
import semver from 'semver';

export type AnalysedPackage = {
  packageName: string;
  packageVersion?: string;
  homepage?: string;
  hasIncompatibleDependencies?: boolean;
  availableUpdate?: string;
};

type Context = {
  currentStorybookVersion: string;
  packageManager: JsPackageManager;
  skipUpgradeCheck?: boolean;
  skipErrors?: boolean;
};

export const checkPackageCompatibility = async (dependency: string, context: Context) => {
  const { currentStorybookVersion, skipErrors, packageManager } = context;
  try {
    const dependencyPackageJson = await packageManager.getPackageJSON(dependency);
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

    const hasIncompatibleDependencies = !!Object.entries({
      ...dependencies,
      ...peerDependencies,
    })
      .filter(([dep]) => storybookCorePackages[dep as keyof typeof storybookCorePackages])
      .find(([_, versionRange]) => {
        // prevent issues with "tag" based versions e.g. "latest" or "next" instead of actual numbers
        return (
          versionRange &&
          semver.validRange(versionRange) &&
          !semver.satisfies(currentStorybookVersion, versionRange)
        );
      });

    const isCorePackage = storybookCorePackages[name as keyof typeof storybookCorePackages];

    let availableUpdate;

    // For now, we notify about updates only for core packages (which will match the currently installed storybook version)
    // In the future, we can use packageManager.latestVersion(name, constraint) for all packages
    if (isCorePackage && semver.gt(currentStorybookVersion, packageVersion!)) {
      availableUpdate = currentStorybookVersion;
    }

    return {
      packageName: name,
      packageVersion,
      homepage,
      hasIncompatibleDependencies,
      availableUpdate,
    };
  } catch (err) {
    if (!skipErrors) {
      console.log(`Error checking compatibility for ${dependency}, please report an issue:\n`, err);
    }
    return { packageName: dependency };
  }
};

export const getIncompatibleStorybookPackages = async (
  context: Omit<Context, 'packageManager'> & Partial<Pick<Context, 'packageManager'>>
): Promise<AnalysedPackage[]> => {
  const packageManager = context.packageManager ?? JsPackageManagerFactory.getPackageManager();

  const allDeps = await packageManager.getAllDependencies();
  const storybookLikeDeps = Object.keys(allDeps).filter((dep) => dep.includes('storybook'));

  if (storybookLikeDeps.length === 0 && !context.skipErrors) {
    throw new Error('No Storybook dependencies found in the package.json');
  }

  return Promise.all(
    storybookLikeDeps.map((dep) => checkPackageCompatibility(dep, { ...context, packageManager }))
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
      `The following packages are incompatible with Storybook ${chalk.bold(
        currentStorybookVersion
      )} as they depend on different major versions of Storybook packages:`
    );
    incompatiblePackages.forEach(
      ({ packageName: addonName, packageVersion: addonVersion, homepage, availableUpdate }) => {
        const packageDescription = `${chalk.cyan(addonName)}@${chalk.cyan(addonVersion)}`;
        const updateMessage = availableUpdate ? ` (${availableUpdate} available!)` : '';
        const packageRepo = homepage ? `\n Repo: ${chalk.yellow(homepage)}` : '';

        summaryMessage.push(`- ${packageDescription}${updateMessage}${packageRepo}`);
      }
    );

    summaryMessage.push(
      '\n',
      'Please consider updating your packages or contacting the maintainers for compatibility details.',
      'For more on Storybook 8 compatibility, see the linked GitHub issue:',
      chalk.yellow('https://github.com/storybookjs/storybook/issues/26031')
    );
  }

  return summaryMessage.join('\n');
};
