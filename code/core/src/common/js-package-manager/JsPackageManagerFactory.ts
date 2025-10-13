import { basename, parse, relative } from 'node:path';

import { sync as spawnSync } from 'cross-spawn';
import * as find from 'empathic/find';

import { getProjectRoot } from '../utils/paths';
import { BUNProxy } from './BUNProxy';
import type { JsPackageManager, PackageManagerName } from './JsPackageManager';
import { COMMON_ENV_VARS } from './JsPackageManager';
import { NPMProxy } from './NPMProxy';
import { PNPMProxy } from './PNPMProxy';
import { Yarn1Proxy } from './Yarn1Proxy';
import { Yarn2Proxy } from './Yarn2Proxy';
import {
  BUN_LOCKFILE,
  BUN_LOCKFILE_BINARY,
  NPM_LOCKFILE,
  PNPM_LOCKFILE,
  YARN_LOCKFILE,
} from './constants';

type PackageManagerProxy =
  | typeof NPMProxy
  | typeof PNPMProxy
  | typeof Yarn1Proxy
  | typeof Yarn2Proxy
  | typeof BUNProxy;

export class JsPackageManagerFactory {
  /** Cache for package manager instances */
  private static cache = new Map<string, JsPackageManager>();

  /** Generate a cache key based on the parameters */
  private static getCacheKey(
    force?: PackageManagerName,
    configDir = '.storybook',
    cwd = process.cwd(),
    storiesPaths?: string[]
  ): string {
    return JSON.stringify({ force: force || null, configDir, cwd, storiesPaths });
  }

  /** Clear the package manager cache */
  public static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Determine which package manager type to use based on lockfiles, commands, and environment
   *
   * @param cwd - Current working directory
   * @returns Package manager type as string: 'npm', 'pnpm', 'bun', 'yarn1', or 'yarn2'
   * @throws Error if no usable package manager is found
   */
  public static getPackageManagerType(cwd = process.cwd()): PackageManagerName {
    const root = getProjectRoot();

    const lockFiles = [
      find.up(YARN_LOCKFILE, { cwd, last: root }),
      find.up(PNPM_LOCKFILE, { cwd, last: root }),
      find.up(NPM_LOCKFILE, { cwd, last: root }),
      find.up(BUN_LOCKFILE, { cwd, last: root }),
      find.up(BUN_LOCKFILE_BINARY, { cwd, last: root }),
    ]
      .filter(Boolean)
      .sort((a, b) => {
        const dirA = parse(a as string).dir;
        const dirB = parse(b as string).dir;

        const compare = relative(dirA, dirB);

        if (dirA === dirB) {
          return 0;
        }

        if (compare.startsWith('..')) {
          return -1;
        }

        return 1;
      });

    // Option 1: We try to infer the package manager from the closest lockfile
    const closestLockfilePath = lockFiles[0];
    const closestLockfile = closestLockfilePath && basename(closestLockfilePath);

    const yarnVersion = getYarnVersion(cwd);

    if (yarnVersion && closestLockfile === YARN_LOCKFILE) {
      return yarnVersion === 1 ? 'yarn1' : 'yarn2';
    }

    if (hasPNPM(cwd) && closestLockfile === PNPM_LOCKFILE) {
      return 'pnpm';
    }

    const isNPMCommandOk = hasNPM(cwd);

    if (isNPMCommandOk && closestLockfile === NPM_LOCKFILE) {
      return 'npm';
    }

    if (
      hasBun(cwd) &&
      (closestLockfile === BUN_LOCKFILE || closestLockfile === BUN_LOCKFILE_BINARY)
    ) {
      return 'bun';
    }

    // Option 2: If the user is running a command via npx/pnpx/yarn create/etc, we infer the package manager from the command
    const inferredPackageManager = this.inferPackageManagerFromUserAgent();
    if (inferredPackageManager && inferredPackageManager in this.PROXY_MAP) {
      return inferredPackageManager;
    }

    // Default fallback, whenever users try to use something different than NPM, PNPM, Yarn,
    // but still have NPM installed
    if (isNPMCommandOk) {
      return 'npm';
    }

    throw new Error('Unable to find a usable package manager within NPM, PNPM, Yarn and Yarn 2');
  }

  public static getPackageManager(
    {
      force,
      configDir = '.storybook',
      storiesPaths,
      ignoreCache = false,
    }: {
      force?: PackageManagerName;
      configDir?: string;
      storiesPaths?: string[];
      ignoreCache?: boolean;
    } = {},
    cwd = process.cwd()
  ): JsPackageManager {
    // Check cache first, unless ignored
    const cacheKey = this.getCacheKey(force, configDir, cwd, storiesPaths);
    const cached = this.cache.get(cacheKey);
    if (cached && !ignoreCache) {
      return cached;
    }

    // Option 1: If the user has provided a forcing flag, we use it
    if (force && force in this.PROXY_MAP) {
      const packageManager = new this.PROXY_MAP[force]({ cwd, configDir, storiesPaths });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    // Option 2: Detect package managers based on some heuristics
    const packageManagerType = this.getPackageManagerType(cwd);
    const packageManager = new this.PROXY_MAP[packageManagerType]({ cwd, configDir, storiesPaths });
    this.cache.set(cacheKey, packageManager);
    return packageManager;
  }

  /** Look up map of package manager proxies by name */
  private static PROXY_MAP: Record<PackageManagerName, PackageManagerProxy> = {
    npm: NPMProxy,
    pnpm: PNPMProxy,
    yarn1: Yarn1Proxy,
    yarn2: Yarn2Proxy,
    bun: BUNProxy,
  };

  /**
   * Infer the package manager based on the command the user is running. Each package manager sets
   * the `npm_config_user_agent` environment variable with its name and version e.g. "npm/7.24.0"
   * Which is really useful when invoking commands via npx/pnpx/yarn create/etc.
   */
  private static inferPackageManagerFromUserAgent(): PackageManagerName | undefined {
    const userAgent = process.env.npm_config_user_agent;
    if (userAgent) {
      const packageSpec = userAgent.split(' ')[0];
      const [pkgMgrName, pkgMgrVersion] = packageSpec.split('/');

      if (pkgMgrName === 'pnpm') {
        return 'pnpm';
      }

      if (pkgMgrName === 'npm') {
        return 'npm';
      }

      if (pkgMgrName === 'yarn') {
        return `yarn${pkgMgrVersion?.startsWith('1.') ? '1' : '2'}`;
      }
    }

    return undefined;
  }
}

function hasNPM(cwd?: string) {
  const npmVersionCommand = spawnSync('npm --version', {
    cwd,
    shell: true,
    env: {
      ...process.env,
      ...COMMON_ENV_VARS,
    },
  });
  return npmVersionCommand.status === 0;
}

function hasBun(cwd?: string) {
  const pnpmVersionCommand = spawnSync('bun --version', {
    cwd,
    shell: true,
    env: {
      ...process.env,
      ...COMMON_ENV_VARS,
    },
  });
  return pnpmVersionCommand.status === 0;
}

function hasPNPM(cwd?: string) {
  const pnpmVersionCommand = spawnSync('pnpm --version', {
    cwd,
    shell: true,
    env: {
      ...process.env,
      ...COMMON_ENV_VARS,
    },
  });
  return pnpmVersionCommand.status === 0;
}

function getYarnVersion(cwd?: string): 1 | 2 | undefined {
  const yarnVersionCommand = spawnSync('yarn --version', {
    cwd,
    shell: true,
    env: {
      ...process.env,
      ...COMMON_ENV_VARS,
    },
  });

  if (yarnVersionCommand.status !== 0) {
    return undefined;
  }

  const yarnVersion = yarnVersionCommand.output.toString().replace(/,/g, '').replace(/"/g, '');

  return /^1\.+/.test(yarnVersion) ? 1 : 2;
}
