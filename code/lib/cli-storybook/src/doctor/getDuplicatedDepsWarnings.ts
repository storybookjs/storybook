import chalk from 'chalk';
import { frameworkPackages, rendererPackages } from 'storybook/internal/common';
import type { InstallationMetadata } from 'storybook/internal/common';
import { hasMultipleVersions } from './hasMultipleVersions';

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
  Object.keys(rendererPackages),
  Object.keys(frameworkPackages),
  'storybook',
  '@storybook/instrumenter',
  '@storybook/core',
  '@storybook/core-server',
  '@storybook/manager',
  '@storybook/preview',
];

export function getDuplicatedDepsWarnings(
  installationMetadata?: InstallationMetadata
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
          acc.critical.push(`${chalk.redBright(dep)}:\n${packageVersions.join(', ')}`);
        } else {
          acc.trivial.push(`${chalk.hex('#ff9800')(dep)}:\n${packageVersions.join(', ')}`);
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
        `${chalk.bold(
          'Critical:'
        )} The following dependencies are duplicated and WILL cause unexpected behavior:`
      );
      messages.push(critical.join(messageDivider), '\n');
    }

    if (trivial.length > 0) {
      messages.push(
        `${chalk.bold(
          'Attention:'
        )} The following dependencies are duplicated which might cause unexpected behavior:`
      );
      messages.push(trivial.join(messageDivider));
    }

    messages.push(
      '\n',
      `Please try de-duplicating these dependencies by running ${chalk.cyan(
        `${installationMetadata.dedupeCommand}`
      )}`
    );

    messages.push(
      '\n',
      `You can find more information for a given dependency by running ${chalk.cyan(
        `${installationMetadata.infoCommand} <package-name>`
      )}`
    );

    return messages;
  } catch (err) {
    return undefined;
  }
}
