import { frameworkPackages, versions as storybookCorePackages } from 'storybook/internal/common';
import type { InstallationMetadata } from 'storybook/internal/common';

import picocolors from 'picocolors';
import semver from 'semver';

function getPrimaryVersion(name: string | undefined, installationMetadata?: InstallationMetadata) {
  if (!name) {
    return undefined;
  }
  const packageMetadata = installationMetadata?.dependencies[name];
  if (!packageMetadata) {
    return undefined;
  }

  return packageMetadata[0]?.version;
}

export function getMismatchingVersionsWarnings(
  installationMetadata?: InstallationMetadata,
  allDependencies?: Record<string, string>
): string | undefined {
  if (!installationMetadata) {
    return undefined;
  }

  const messages: string[] = [];
  try {
    const frameworkPackageName = Object.keys(installationMetadata?.dependencies || []).find(
      (packageName) => {
        return Object.keys(frameworkPackages).includes(packageName);
      }
    );
    const cliVersion = getPrimaryVersion('storybook', installationMetadata);
    const frameworkVersion = getPrimaryVersion(frameworkPackageName, installationMetadata);

    if (!cliVersion || !frameworkVersion || semver.eq(cliVersion, frameworkVersion)) {
      return undefined;
    }

    messages.push(
      `${picocolors.bold(
        'Attention:'
      )} There seems to be a mismatch between your Storybook package versions. This can result in a broken Storybook installation.`
    );

    let versionToCompare: string;
    let packageToDisplay: string;
    if (semver.lt(cliVersion, frameworkVersion)) {
      versionToCompare = frameworkVersion;
      packageToDisplay = frameworkPackageName as string;
    } else {
      versionToCompare = cliVersion;
      packageToDisplay = 'storybook';
    }

    messages.push(
      `The version of your storybook core packages should align with ${picocolors.yellow(
        versionToCompare
      )} (from the ${picocolors.cyan(packageToDisplay)} package) or higher.`
    );

    const filteredDependencies = Object.entries(installationMetadata?.dependencies || []).filter(
      ([name, packages]) => {
        if (Object.keys(storybookCorePackages).includes(name)) {
          const packageVersion = packages[0].version;
          return packageVersion !== versionToCompare;
        }

        return false;
      }
    );

    if (filteredDependencies.length > 0) {
      const packageJsonSuffix = '(in your package.json)';
      messages.push(
        `Based on your lockfile, these dependencies should be aligned:`,
        filteredDependencies
          .map(
            ([name, dep]) =>
              `${picocolors.yellow(name)}: ${dep[0].version} ${
                allDependencies?.[name] ? packageJsonSuffix : ''
              }`
          )
          .sort(
            (a, b) =>
              (b.includes(packageJsonSuffix) ? 1 : 0) - (a.includes(packageJsonSuffix) ? 1 : 0)
          )
          .join('\n')
      );
    }

    messages.push(
      `You can run ${picocolors.cyan(
        'npx storybook@latest upgrade'
      )} to upgrade all of your Storybook packages to the latest version.

      Alternatively you can try manually changing the versions to match in your package.json. We also recommend regenerating your lockfile, or running the following command to possibly deduplicate your Storybook package versions: ${picocolors.cyan(
        installationMetadata?.dedupeCommand
      )}`
    );

    return messages.join('\n\n');
  } catch (err) {
    return undefined;
  }
}
