import type { PackageJson } from 'storybook/internal/types';

import semver from 'semver';

import {
  BUNDLER_PACKAGES,
  DATA_FETCHING_PACKAGES,
  I18N_PACKAGES,
  ROUTER_PACKAGES,
  STATE_MANAGEMENT_PACKAGES,
  STYLING_PACKAGES,
  TEST_PACKAGES,
  UI_LIBRARY_PACKAGES,
  matchesPackagePattern,
} from '../shared/utils/ecosystem-identifier.ts';
import { getActualPackageVersion } from './package-json.ts';

type PackageGroupResult = Record<string, string | null | undefined>;

export type KnownPackagesList = {
  testPackages?: PackageGroupResult;
  bundlerPackages?: PackageGroupResult;
  /**
   * Installed versions of the active renderer's UI framework runtime packages. Unlike the other
   * groups, this is keyed off the detected Storybook renderer rather than the project's declared
   * dependencies, so monorepos don't report sibling frameworks.
   */
  rendererPackages?: PackageGroupResult;
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

  try {
    const operator = version.trim().match(/^[~^]/)?.[0] ?? '';
    const coerced = semver.coerce(version);
    return coerced ? `${operator}${coerced.version}` : null;
  } catch {
    return 'could-not-be-parsed-by-semver';
  }
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

  // Groups whose exact installed version matters are resolved from the install tree, with the
  // declared specifier as a fallback.
  const pickResolvedDepsObject = async (packages: readonly string[]) => {
    const result = Object.fromEntries(
      await Promise.all(
        pickMatches(packages).map(async (dep) => {
          const resolved = (await getActualPackageVersion(dep))?.version ?? allDependencies[dep];

          const version = getSafeVersionSpecifier(resolved);
          return [dep, version];
        })
      )
    );
    return Object.keys(result).length === 0 ? null : result;
  };

  const testPackages = await pickResolvedDepsObject(TEST_PACKAGES);
  const bundlerPackages = await pickResolvedDepsObject(BUNDLER_PACKAGES);

  const stylingPackages = pickDepsObject(STYLING_PACKAGES);
  const stateManagementPackages = pickDepsObject(STATE_MANAGEMENT_PACKAGES);
  const dataFetchingPackages = pickDepsObject(DATA_FETCHING_PACKAGES);
  const uiLibraryPackages = pickDepsObject(UI_LIBRARY_PACKAGES);
  const i18nPackages = pickDepsObject(I18N_PACKAGES);
  const routerPackages = pickDepsObject(ROUTER_PACKAGES);

  return {
    ...(testPackages && { testPackages: testPackages }),
    ...(bundlerPackages && { bundlerPackages: bundlerPackages }),
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
