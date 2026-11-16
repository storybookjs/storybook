import { basename, parse, relative } from 'node:path';

import * as find from 'empathic/find';

import { getProjectRoot } from '../utils/paths.ts';
import { PackageManagerName } from './JsPackageManager.ts';
import {
  BUN_LOCKFILE,
  BUN_LOCKFILE_BINARY,
  NPM_LOCKFILE,
  PNPM_LOCKFILE,
  YARN_LOCKFILE,
} from './constants.ts';

/** The package manager each lockfile belongs to. Yarn 1 and Yarn Berry share `yarn.lock`. */
export const LOCKFILE_PACKAGE_MANAGERS: Record<string, PackageManagerName> = {
  [YARN_LOCKFILE]: PackageManagerName.YARN2,
  [PNPM_LOCKFILE]: PackageManagerName.PNPM,
  [NPM_LOCKFILE]: PackageManagerName.NPM,
  [BUN_LOCKFILE]: PackageManagerName.BUN,
  [BUN_LOCKFILE_BINARY]: PackageManagerName.BUN,
};

/**
 * Return the file name of the lockfile closest to `cwd`, searching up to the project root, without
 * running any package manager.
 */
export function findClosestLockfile(
  cwd = process.cwd(),
  last = getProjectRoot()
): string | undefined {
  const lockFiles = Object.keys(LOCKFILE_PACKAGE_MANAGERS)
    .map((lockfile) => find.up(lockfile, { cwd, last }))
    .filter((path): path is string => Boolean(path))
    .sort((a, b) => {
      const dirA = parse(a).dir;
      const dirB = parse(b).dir;
      if (dirA === dirB) {
        return 0;
      }
      return relative(dirA, dirB).startsWith('..') ? -1 : 1;
    });
  return lockFiles[0] && basename(lockFiles[0]);
}

/**
 * Infer the package manager from the command the user is running. Each package manager sets the
 * `npm_config_user_agent` environment variable with its name and version, e.g. "npm/7.24.0", which
 * is useful when invoking commands via npx/pnpx/yarn create/etc.
 */
export function inferPackageManagerFromUserAgent(
  userAgent = process.env.npm_config_user_agent
): PackageManagerName | undefined {
  if (!userAgent) {
    return undefined;
  }
  const [pkgMgrName, pkgMgrVersion] = userAgent.split(' ')[0].split('/');
  if (pkgMgrName === 'pnpm') {
    return PackageManagerName.PNPM;
  }
  if (pkgMgrName === 'npm') {
    return PackageManagerName.NPM;
  }
  if (pkgMgrName === 'yarn') {
    return pkgMgrVersion?.startsWith('1.') ? PackageManagerName.YARN1 : PackageManagerName.YARN2;
  }
  return undefined;
}
