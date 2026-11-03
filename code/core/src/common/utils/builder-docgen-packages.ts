import { readFileSync } from 'node:fs';
import { dirname, join } from 'pathe';
import { fileURLToPath } from 'node:url';

import * as find from 'empathic/find';
import { satisfies } from 'semver';

import { PackageManagerName } from '../js-package-manager/JsPackageManager.ts';
import {
  BUN_LOCKFILE,
  BUN_LOCKFILE_BINARY,
  NPM_LOCKFILE,
  PNPM_LOCKFILE,
  YARN_LOCKFILE,
} from '../js-package-manager/constants.ts';
import { getProjectRoot } from './paths.ts';

/**
 * Packages that only the deprecated builder docgen (`features.docgenServer: false`) uses, with the
 * version range to install. The React packages declare them as optional peer dependencies, so
 * projects on the docgen server do not install them.
 *
 * Each range must equal the peer dependency range in the package.json files of
 * `@storybook/react`, `@storybook/react-vite` and `@storybook/preset-react-webpack`, which a test
 * checks.
 */
export const BUILDER_DOCGEN_PACKAGES = {
  'react-docgen': '^8.0.2',
  'react-docgen-typescript': '^2.2.2',
  '@joshwooding/vite-plugin-react-docgen-typescript': '^0.7.0 || ^0.8.0 || ^0.9.0',
  '@storybook/react-docgen-typescript-plugin': '1.0.6--canary.9.0c3f3b7.0',
} as const;

export type BuilderDocgenPackage = keyof typeof BUILDER_DOCGEN_PACKAGES;

/** The `typescript.reactDocgen` main config option. */
export type ReactDocgenOption = 'react-docgen' | 'react-docgen-typescript' | false;

/**
 * Return the packages that React builder docgen needs for a `typescript.reactDocgen` value.
 *
 * `react-docgen-typescript` mode needs the builder plugin and `react-docgen-typescript` itself,
 * which `@storybook/react` loads for the components manifest. In that mode the `react-docgen` pass
 * over JavaScript files is skipped when `react-docgen` is not installed.
 */
export function getReactBuilderDocgenPackages(
  reactDocgen: ReactDocgenOption | undefined,
  builder: 'vite' | 'webpack'
): BuilderDocgenPackage[] {
  if (reactDocgen === 'react-docgen') {
    return ['react-docgen'];
  }
  if (reactDocgen === 'react-docgen-typescript') {
    return [
      builder === 'vite'
        ? '@joshwooding/vite-plugin-react-docgen-typescript'
        : '@storybook/react-docgen-typescript-plugin',
      'react-docgen-typescript',
    ];
  }
  return [];
}

/**
 * Return the version of a builder docgen package as it resolves, or `undefined` when it does not
 * resolve. The version is `null` when no package.json for it can be read.
 *
 * `resolve` must resolve from the package that declares the optional peer dependency, for example
 * `(specifier) => import.meta.resolve(specifier)`, because strict package managers only expose a
 * peer to the packages that declare it.
 */
export function getResolvedBuilderDocgenPackageVersion(
  resolve: (specifier: string) => string,
  packageName: BuilderDocgenPackage
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
 * Return whether a builder docgen package resolves in a version that satisfies its peer range.
 *
 * An older major hoisted by another dependency, such as `react-docgen@5`, does not count: Storybook
 * would crash on its API instead of reporting the missing package.
 */
export function isBuilderDocgenPackageInstalled(
  resolve: (specifier: string) => string,
  packageName: BuilderDocgenPackage
): boolean {
  const version = getResolvedBuilderDocgenPackageVersion(resolve, packageName);
  return (
    version !== undefined &&
    (version === null ||
      satisfies(version, BUILDER_DOCGEN_PACKAGES[packageName], { includePrerelease: true }))
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

const LOCKFILE_PACKAGE_MANAGERS: [string, PackageManagerName][] = [
  [PNPM_LOCKFILE, PackageManagerName.PNPM],
  [YARN_LOCKFILE, PackageManagerName.YARN2],
  [BUN_LOCKFILE, PackageManagerName.BUN],
  [BUN_LOCKFILE_BINARY, PackageManagerName.BUN],
  [NPM_LOCKFILE, PackageManagerName.NPM],
];

const USER_AGENT_PACKAGE_MANAGERS: Record<string, PackageManagerName> = {
  npm: PackageManagerName.NPM,
  pnpm: PackageManagerName.PNPM,
  yarn: PackageManagerName.YARN2,
  bun: PackageManagerName.BUN,
};

/**
 * Guess the project's package manager for an install hint, from the closest lockfile and then the
 * user agent of the running command.
 *
 * Unlike `JsPackageManagerFactory.getPackageManagerType`, it spawns no package manager to check
 * its version: presets call it while Storybook starts, where that costs about half a second. Yarn
 * 1 and Yarn Berry share the same `add` command, so telling them apart is not needed.
 */
export function findPackageManagerForInstallHint({
  cwd = process.cwd(),
  last = getProjectRoot(),
  userAgent = process.env.npm_config_user_agent,
}: { cwd?: string; last?: string; userAgent?: string } = {}): PackageManagerName {
  let closest: { dir: string; packageManager: PackageManagerName } | undefined;
  for (const [lockfile, packageManager] of LOCKFILE_PACKAGE_MANAGERS) {
    const found = find.up(lockfile, { cwd, last });
    const dir = found ? dirname(found) : undefined;
    if (dir && (!closest || dir.length > closest.dir.length)) {
      closest = { dir, packageManager };
    }
  }
  return (
    closest?.packageManager ??
    USER_AGENT_PACKAGE_MANAGERS[userAgent?.split('/')[0] ?? ''] ??
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

/**
 * Return `name@range` for each package, as install commands take them. A range with alternatives
 * installs its newest one, such as `^0.9.0` for `^0.7.0 || ^0.8.0 || ^0.9.0`.
 */
const getBuilderDocgenPackageSpecifiers = (packages: readonly BuilderDocgenPackage[]) =>
  packages.map((name) => `${name}@${BUILDER_DOCGEN_PACKAGES[name].split('||').at(-1)!.trim()}`);

/**
 * Return the command that adds builder docgen packages to the project's devDependencies.
 *
 * Specifiers with a range character such as `^` are quoted, so the command works in every shell.
 */
export function getAddBuilderDocgenPackagesCommand(
  packages: readonly BuilderDocgenPackage[],
  packageManager = detectPackageManagerForInstallHint()
) {
  const specifiers = getBuilderDocgenPackageSpecifiers(packages).map((specifier) =>
    /^[\w@/.-]+$/.test(specifier) ? specifier : `"${specifier}"`
  );
  // pnpm refuses to add a dependency to a workspace root without `-w`.
  const workspaceRootFlag =
    packageManager === PackageManagerName.PNPM && isPnpmWorkspaceRoot() ? ['-w'] : [];
  return [ADD_DEV_DEPENDENCY_COMMANDS[packageManager], ...workspaceRootFlag, ...specifiers].join(
    ' '
  );
}

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
