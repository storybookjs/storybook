import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as find from 'empathic/find';
import { dirname, join } from 'pathe';
import { satisfies } from 'semver';

import { PackageManagerName } from '../js-package-manager/JsPackageManager.ts';
import {
  LOCKFILE_PACKAGE_MANAGERS,
  findClosestLockfile,
  inferPackageManagerFromUserAgent,
} from '../js-package-manager/lockfile.ts';
import { getProjectRoot } from './paths.ts';

/**
 * Packages that a renderer's deprecated builder docgen needs, mapped to the version range it
 * supports. Renderers declare them as optional peer dependencies, so projects on the docgen server
 * do not install them.
 */
export type BuilderDocgenPackages = Readonly<Record<string, string>>;

/**
 * Return the version of a package as it resolves, `undefined` when it does not resolve, or `null`
 * when no package.json for it can be read.
 *
 * `resolve` must resolve from the package that declares the optional peer dependency, for example
 * `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose a
 * peer to the packages that declare it.
 */
export function getResolvedPackageVersion(
  resolve: (specifier: string) => string,
  packageName: string
): string | null | undefined {
  let entry: string;
  try {
    entry = fileURLToPath(resolve(packageName));
  } catch {
    return undefined;
  }
  // Not every package exports its package.json, so walk up from the resolved entry instead.
  for (let dir = dirname(entry); dir !== dirname(dir); dir = dirname(dir)) {
    try {
      const packageJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
      if (packageJson.name === packageName) {
        return typeof packageJson.version === 'string' ? packageJson.version : null;
      }
    } catch {
      // No package.json in this directory.
    }
  }
  return null;
}

/**
 * Return whether a package resolves in a version that satisfies `range`.
 *
 * An older major hoisted by another dependency, such as `react-docgen@5`, does not count: Storybook
 * would crash on its API instead of reporting the missing package.
 */
export function isPackageInstalledInRange(
  resolve: (specifier: string) => string,
  packageName: string,
  range: string
): boolean {
  const version = getResolvedPackageVersion(resolve, packageName);
  return (
    version !== undefined &&
    (version === null || satisfies(version, range, { includePrerelease: true }))
  );
}

/** Return whether an import failed because a module or package could not be found. */
export const isModuleNotFoundError = (error: unknown) =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND');

const ADD_DEV_DEPENDENCY_COMMANDS: Record<PackageManagerName, string> = {
  [PackageManagerName.NPM]: 'npm install -D',
  [PackageManagerName.YARN1]: 'yarn add -D',
  [PackageManagerName.YARN2]: 'yarn add -D',
  [PackageManagerName.PNPM]: 'pnpm add -D',
  [PackageManagerName.BUN]: 'bun add -D',
};

/**
 * Guess the project's package manager for an install hint, from the closest lockfile and then the
 * user agent of the running command.
 *
 * It shares the lockfile and user agent lookup with `JsPackageManagerFactory.getPackageManagerType`,
 * but spawns no package manager to check its version: presets call it while Storybook starts, where
 * that costs about half a second. Yarn 1 and Yarn Berry share the same `add` command.
 */
export function findPackageManagerForInstallHint({
  cwd = process.cwd(),
  last = getProjectRoot(),
  userAgent = process.env.npm_config_user_agent,
}: { cwd?: string; last?: string; userAgent?: string } = {}): PackageManagerName {
  const lockfile = findClosestLockfile(cwd, last);
  return (
    (lockfile && LOCKFILE_PACKAGE_MANAGERS[lockfile]) ||
    inferPackageManagerFromUserAgent(userAgent) ||
    PackageManagerName.NPM
  );
}

let detectedPackageManager: PackageManagerName | undefined;

/** {@link findPackageManagerForInstallHint} for the current project, cached for the process. */
const detectPackageManagerForInstallHint = () => {
  if (!detectedPackageManager) {
    try {
      detectedPackageManager = findPackageManagerForInstallHint();
    } catch {
      detectedPackageManager = PackageManagerName.NPM;
    }
  }
  return detectedPackageManager;
};

/** Return whether the package that contains `cwd` is the root of a pnpm workspace. */
export function isPnpmWorkspaceRoot(cwd = process.cwd()) {
  try {
    const workspaceFile = find.up('pnpm-workspace.yaml', { cwd, last: getProjectRoot() });
    const packageJson = find.up('package.json', { cwd });
    return !!workspaceFile && !!packageJson && dirname(workspaceFile) === dirname(packageJson);
  } catch {
    return false;
  }
}

/**
 * Return the command that adds packages to the project's devDependencies.
 *
 * A range with alternatives installs its newest one, such as `^0.9.0` for `^0.7.0 || ^0.9.0`.
 * Specifiers with a range character such as `^` are quoted, so the command works in every shell.
 */
export function getAddDevDependenciesCommand(
  packages: BuilderDocgenPackages,
  packageManager = detectPackageManagerForInstallHint()
) {
  const specifiers = Object.entries(packages)
    .map(([name, range]) => `${name}@${range.split('||').at(-1)!.trim()}`)
    .map((specifier) => (/^[\w@/.-]+$/.test(specifier) ? specifier : `"${specifier}"`));
  // pnpm refuses to add a dependency to a workspace root without `-w`.
  const workspaceRootFlag =
    packageManager === PackageManagerName.PNPM && isPnpmWorkspaceRoot() ? ['-w'] : [];
  return [ADD_DEV_DEPENDENCY_COMMANDS[packageManager], ...workspaceRootFlag, ...specifiers].join(
    ' '
  );
}
