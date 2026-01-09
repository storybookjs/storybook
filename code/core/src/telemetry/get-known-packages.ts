import type { PackageJson } from 'storybook/internal/types';

import semver from 'semver';

import {
  DATA_FETCHING_PACKAGES,
  I18N_PACKAGES,
  ROUTER_PACKAGES,
  STATE_MANAGEMENT_PACKAGES,
  STYLING_PACKAGES,
  TEST_PACKAGES,
  UI_LIBRARY_PACKAGES,
  matchesPackagePattern,
} from '../shared/utils/ecosystem-identifier';
import { getActualPackageVersion } from './package-json';

type PackageGroupResult = Record<string, string | undefined>;

export type KnownPackagesList = {
  testPackages?: PackageGroupResult;
  stylingPackages?: PackageGroupResult;
  stateManagementPackages?: PackageGroupResult;
  dataFetchingPackages?: PackageGroupResult;
  uiLibraryPackages?: PackageGroupResult;
  i18nPackages?: PackageGroupResult;
  routerPackages?: PackageGroupResult;
};

export function getSafeVersionSpecifier(version?: string): string | null {
  if (!version) {
    return null;
  }

  if (version === '*') {
    return 'latest';
  }

  // e.g. file, patch, workspace, git and other protocols
  if (version.includes(':')) {
    return 'custom-protocol';
  }

  // common dist-tags
  if (
    [
      'latest',
      'next',
      'canary',
      'beta',
      'alpha',
      'rc',
      'nightly',
      'dev',
      'stable',
      'experimental',
      'insiders',
      'preview',
    ].includes(version)
  ) {
    return version;
  }

  const operator = version.trim().match(/^[~^]/)?.[0] ?? '';
  const coerced = semver.coerce(version);
  return coerced ? `${operator}${coerced.version}` : null;
}

export async function analyzeEcosystemPackages(
  packageJson: PackageJson
): Promise<KnownPackagesList> {
  const allDependencies = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies,
    ...packageJson?.peerDependencies,
  };

  const depNames = Object.keys(allDependencies);

  const pickMatches = (packages: readonly string[]) =>
    depNames.filter((dep) => matchesPackagePattern(dep, packages));

  const pickDepsObject = (packages: readonly string[]) => {
    const result = Object.fromEntries(
      pickMatches(packages).map((dep) => {
        const rawVersion = allDependencies[dep];
        const version = getSafeVersionSpecifier(rawVersion);
        return [dep, version];
      })
    );
    return Object.keys(result).length === 0 ? null : result;
  };

  const testPackagesResult = Object.fromEntries(
    await Promise.all(
      depNames
        .filter((dep) => matchesPackagePattern(dep, TEST_PACKAGES))
        .map(async (dep) => {
          const resolved = (await getActualPackageVersion(dep))?.version ?? allDependencies[dep];

          const version = getSafeVersionSpecifier(resolved);
          return [dep, version];
        })
    )
  );
  const testPackages = Object.keys(testPackagesResult).length === 0 ? null : testPackagesResult;

  const stylingPackages = pickDepsObject(STYLING_PACKAGES);
  const stateManagementPackages = pickDepsObject(STATE_MANAGEMENT_PACKAGES);
  const dataFetchingPackages = pickDepsObject(DATA_FETCHING_PACKAGES);
  const uiLibraryPackages = pickDepsObject(UI_LIBRARY_PACKAGES);
  const i18nPackages = pickDepsObject(I18N_PACKAGES);
  const routerPackages = pickDepsObject(ROUTER_PACKAGES);

  return {
    ...(testPackages && { testPackages: testPackages }),
    ...(stylingPackages && { stylingPackages: stylingPackages }),
    ...(stateManagementPackages && {
      stateManagementPackages: stateManagementPackages,
    }),
    ...(dataFetchingPackages && { dataFetchingPackages: dataFetchingPackages }),
    ...(uiLibraryPackages && { uiLibraryPackages: uiLibraryPackages }),
    ...(i18nPackages && { i18nPackages: i18nPackages }),
    ...(routerPackages && { routerPackages: routerPackages }),
  };
}
