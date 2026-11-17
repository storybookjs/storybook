import { frameworkPackages, rendererPackages } from 'storybook/internal/common';
import type { InstallationMetadata } from 'storybook/internal/common';

import picocolors from 'picocolors';
import semver from 'semver';

import type { AnalysedPackage } from './getIncompatibleStorybookPackages.ts';
import { hasMultipleVersions } from './hasMultipleVersions.ts';

export const messageDivider = '\n\n';

// These packages are aliased by Storybook, so it doesn't matter if they're duplicated
export const allowList = [
  '@storybook/csf',
  // see this file for more info: code/lib/preview/src/globals/types.ts
  '@storybook/addons',
  '@storybook/channel-postmessage',
  '@storybook/channel-websocket',
  '@storybook/client-api',
  '@storybook/core-client',
  '@storybook/preview-web',
  '@storybook/store',

  // see this file for more info: code/ui/manager/src/globals/types.ts
  '@storybook/components',
  '@storybook/router',
  '@storybook/theming',
  '@storybook/api',
  '@storybook/manager-api',
];

// These packages definitely will cause issues if they're duplicated
export const disallowList = [
  ...Object.keys(rendererPackages),
  ...Object.keys(frameworkPackages),
  'storybook',
  '@storybook/instrumenter',
  '@storybook/core-server',
  '@storybook/manager',
  '@storybook/preview',
];

/** Names the incompatible packages whose Storybook range keeps each stale `storybook` copy installed. */
const getStaleStorybookSources = (
  versions: string[] = [],
  incompatiblePackages: AnalysedPackage[] = []
) =>
  versions.flatMap((version) => {
    const sources = incompatiblePackages.filter(
      ({ hasIncompatibleDependencies, packageStorybookVersion }) =>
        hasIncompatibleDependencies &&
        packageStorybookVersion &&
        semver.satisfies(version, packageStorybookVersion, { includePrerelease: true })
    );
    return sources.length
      ? [
          `storybook ${version} is installed for ${sources
            .map(({ packageName, packageStorybookVersion }) =>
              picocolors.bold(`${packageName} (${packageStorybookVersion})`)
            )
            .join(', ')}. De-duplicating won't remove it: update or remove ${
            sources.length > 1 ? 'these packages' : 'that package'
          }.`,
        ]
      : [];
  });

export function getDuplicatedDepsWarnings(
  installationMetadata?: InstallationMetadata,
  incompatiblePackages?: AnalysedPackage[]
): string[] | undefined {
  try {
    if (
      !installationMetadata ||
      !installationMetadata?.duplicatedDependencies ||
      Object.keys(installationMetadata.duplicatedDependencies).length === 0
    ) {
      return undefined;
    }

    const messages: string[] = [];

    const { critical, trivial } = Object.entries(
      installationMetadata?.duplicatedDependencies
    ).reduce<{
      critical: string[];
      trivial: string[];
    }>(
      (acc, [dep, packageVersions]) => {
        if (allowList.includes(dep)) {
          return acc;
        }

        const hasMultipleMajorVersions = hasMultipleVersions(packageVersions);

        if (disallowList.includes(dep) && hasMultipleMajorVersions) {
          acc.critical.push(
            `${picocolors.bold(picocolors.red(dep))}:\n${packageVersions.join(', ')}`
          );
        } else {
          acc.trivial.push(`${picocolors.yellow(dep)}:\n${packageVersions.join(', ')}`);
        }

        return acc;
      },
      { critical: [], trivial: [] }
    );

    if (critical.length === 0 && trivial.length === 0) {
      return messages;
    }

    if (critical.length > 0) {
      messages.push(
        `${picocolors.bold(
          'Critical:'
        )} The following dependencies are duplicated and WILL cause unexpected behavior:`
      );
      messages.push(critical.join(messageDivider), '\n');
      messages.push(
        ...getStaleStorybookSources(
          installationMetadata.duplicatedDependencies.storybook,
          incompatiblePackages
        )
      );
    }

    if (trivial.length > 0) {
      messages.push(
        `${picocolors.bold(
          'Attention:'
        )} The following dependencies are duplicated which might cause unexpected behavior:`
      );
      messages.push(trivial.join(messageDivider));
    }

    messages.push(
      '\n',
      `Please try de-duplicating these dependencies by running ${picocolors.cyan(
        `${installationMetadata.dedupeCommand}`
      )}`
    );

    messages.push(
      '\n',
      `You can find more information for a given dependency by running ${picocolors.cyan(
        `${installationMetadata.infoCommand} <package-name>`
      )}`
    );

    return messages;
  } catch (err) {
    return undefined;
  }
}
