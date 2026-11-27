import semver from 'semver';

/** A core package deprecated as of a Storybook release, with its migration story. */
export interface DeprecatedPackageEntry {
  /** The first Storybook version that deprecates the packages. */
  minVersion: string;
  /** The deprecated packages. */
  deprecations: string[];
  /** Where the deprecation is documented. */
  url: string;
  /** The Storybook version that will remove the packages, when one is planned. */
  removalVersion?: string;
  /** The automigration that moves a project off the packages, when one exists. */
  automigrateFixId?: string;
}

/**
 * Every deprecation the CLI reports, with the version it starts at and how to migrate. The doctor's
 * deprecation diagnostic reads from here; keep new deprecations in this one table.
 */
export const deprecatedPackages: DeprecatedPackageEntry[] = [
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
    minVersion: '11.0.0',
    url: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nextjs-storybooknextjs-is-deprecated',
    deprecations: ['@storybook/nextjs'],
    removalVersion: '12.0.0',
    // The id of the `storybook automigrate` migration, mirrored by the fix's own opt-out warning.
    automigrateFixId: 'nextjs-to-nextjs-vite',
  },
];

export interface AppliedDeprecation {
  entry: DeprecatedPackageEntry;
  /** The entry's deprecated packages the project has installed. */
  installed: string[];
}

/** The deprecations that apply to a Storybook version and are present in a project's dependencies. */
export const getAppliedDeprecations = ({
  storybookVersion,
  installedDependencies,
}: {
  storybookVersion: string | undefined;
  installedDependencies: Record<string, string>;
}): AppliedDeprecation[] => {
  const version = semver.coerce(storybookVersion ?? '');
  if (!version) {
    return [];
  }

  return deprecatedPackages
    .filter((entry) => semver.gte(version, entry.minVersion))
    .map((entry) => ({
      entry,
      installed: entry.deprecations.filter((pkg) => !!installedDependencies[pkg]),
    }))
    .filter(({ installed }) => installed.length > 0);
};

const describeDeprecatedPackage = (pkg: string, entry: DeprecatedPackageEntry): string => {
  const removal = entry.removalVersion
    ? ` and will be removed in Storybook ${semver.major(semver.coerce(entry.removalVersion) ?? entry.removalVersion)}`
    : '';
  const migration = entry.automigrateFixId
    ? `\n  Migrate off it by running \`npx storybook automigrate ${entry.automigrateFixId}\`.`
    : '';
  return `- ${pkg} is deprecated${removal}.${migration}`;
};

/** The doctor's deprecation warning for applied deprecations, each with its migration path. */
export const getDeprecatedPackagesMessage = (appliedDeprecations: AppliedDeprecation[]): string =>
  appliedDeprecations
    .map(({ entry, installed }) =>
      [
        `Found deprecated packages since Storybook ${entry.minVersion}:`,
        '',
        ...installed.map((pkg) => describeDeprecatedPackage(pkg, entry)),
        '',
        `See ${entry.url}`,
      ].join('\n')
    )
    .join('\n\n');
