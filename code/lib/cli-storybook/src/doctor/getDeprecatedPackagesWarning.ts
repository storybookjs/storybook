import type { InstallationMetadata } from 'storybook/internal/common';

import picocolors from 'picocolors';
import semver from 'semver';

// A prerelease minVersion (`-alpha.0`) makes the check apply to that major's betas and release candidates too.
export const deprecatedPackages = [
  {
    minVersion: '6.0.0-alpha.0',
    url: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#60-deprecations',
    deprecations: [
      '@storybook/addon-notes',
      '@storybook/addon-info',
      '@storybook/addon-contexts',
      '@storybook/addon-options',
      '@storybook/addon-centered',
    ],
  },
  {
    minVersion: '11.0.0-alpha.0',
    url: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nextjs-storybooknextjs-is-deprecated',
    deprecations: ['@storybook/nextjs'],
  },
];

export function getDeprecatedPackagesWarning(
  installationMetadata: InstallationMetadata | undefined,
  storybookVersion: string,
  projectDependencies: Record<string, string>
): string | undefined {
  if (!installationMetadata || !semver.valid(storybookVersion)) {
    return undefined;
  }

  const lines = deprecatedPackages
    .filter(({ minVersion }) => semver.gte(storybookVersion, minVersion))
    .flatMap(({ minVersion, url, deprecations }) =>
      deprecations
        .filter(
          (name) => name in projectDependencies && installationMetadata.dependencies[name]?.length
        )
        .map((name) => {
          const version = installationMetadata.dependencies[name][0].version;
          return `- ${picocolors.cyan(`${name}@${version}`)} is deprecated since Storybook ${semver.major(minVersion)}. See ${url}`;
        })
    );

  return lines.length > 0 ? lines.join('\n') : undefined;
}
