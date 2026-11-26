import type { InstallationMetadata } from 'storybook/internal/common';

import picocolors from 'picocolors';
import semver from 'semver';

// A prerelease minVersion (`-alpha.0`) makes the check apply to that major's betas and release candidates too.
const deprecatedPackages: {
  minVersion: string;
  url: string;
  deprecations: string[];
  nextStep?: string;
}[] = [
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
    nextStep: 'Run `storybook automigrate nextjs-to-nextjs-vite` to migrate.',
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
    .flatMap(({ minVersion, url, deprecations, nextStep }) =>
      deprecations.flatMap((name) => {
        const [installed] = installationMetadata.dependencies[name] ?? [];
        if (!installed || !(name in projectDependencies)) {
          return [];
        }
        const line = `- ${picocolors.cyan(`${name}@${installed.version}`)} is deprecated since Storybook ${semver.major(minVersion)}. See ${url}`;
        return [nextStep ? `${line}\n  ${nextStep}` : line];
      })
    );

  return lines.length > 0 ? lines.join('\n') : undefined;
}
