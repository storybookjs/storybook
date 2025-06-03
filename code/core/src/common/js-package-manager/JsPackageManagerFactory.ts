import { basename, parse, relative } from 'node:path';

import { sync as spawnSync } from 'cross-spawn';
import { findUpSync } from 'find-up';

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
    cwd = process.cwd()
  ): string {
    return JSON.stringify({ force: force || null, configDir, cwd });
  }

  /** Clear the package manager cache */
  public static clearCache(): void {
    this.cache.clear();
  }

  public static getPackageManager(
    { force, configDir = '.storybook' }: { force?: PackageManagerName; configDir?: string } = {},
    cwd = process.cwd()
  ): JsPackageManager {
    // Check cache first
    const cacheKey = this.getCacheKey(force, configDir, cwd);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Option 1: If the user has provided a forcing flag, we use it
    if (force && force in this.PROXY_MAP) {
      const packageManager = new this.PROXY_MAP[force]({ cwd, configDir });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    const root = getProjectRoot();

    const lockFiles = [
      findUpSync(YARN_LOCKFILE, { cwd, stopAt: root }),
      findUpSync(PNPM_LOCKFILE, { cwd, stopAt: root }),
      findUpSync(NPM_LOCKFILE, { cwd, stopAt: root }),
      findUpSync(BUN_LOCKFILE, { cwd, stopAt: root }),
      findUpSync(BUN_LOCKFILE_BINARY, { cwd, stopAt: root }),
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

    // Option 2: We try to infer the package manager from the closest lockfile
    const closestLockfilePath = lockFiles[0];

    const closestLockfile = closestLockfilePath && basename(closestLockfilePath);

    const yarnVersion = getYarnVersion(cwd);

    if (yarnVersion && closestLockfile === YARN_LOCKFILE) {
      const packageManager =
        yarnVersion === 1 ? new Yarn1Proxy({ cwd, configDir }) : new Yarn2Proxy({ cwd, configDir });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    if (hasPNPM(cwd) && closestLockfile === PNPM_LOCKFILE) {
      const packageManager = new PNPMProxy({ cwd, configDir });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    if (hasNPM(cwd) && closestLockfile === NPM_LOCKFILE) {
      const packageManager = new NPMProxy({ cwd, configDir });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    if (
      hasBun(cwd) &&
      (closestLockfile === BUN_LOCKFILE || closestLockfile === BUN_LOCKFILE_BINARY)
    ) {
      const packageManager = new BUNProxy({ cwd, configDir });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    // Option 3: If the user is running a command via npx/pnpx/yarn create/etc, we infer the package manager from the command
    const inferredPackageManager = this.inferPackageManagerFromUserAgent();
    if (inferredPackageManager && inferredPackageManager in this.PROXY_MAP) {
      const packageManager = new this.PROXY_MAP[inferredPackageManager]({ cwd });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    // Default fallback, whenever users try to use something different than NPM, PNPM, Yarn,
    // but still have NPM installed
    if (hasNPM(cwd)) {
      const packageManager = new NPMProxy({ cwd, configDir });
      this.cache.set(cacheKey, packageManager);
      return packageManager;
    }

    throw new Error('Unable to find a usable package manager within NPM, PNPM, Yarn and Yarn 2');
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
  const npmVersionCommand = spawnSync('npm', ['--version'], {
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
  const pnpmVersionCommand = spawnSync('bun', ['--version'], {
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
  const pnpmVersionCommand = spawnSync('pnpm', ['--version'], {
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
  const yarnVersionCommand = spawnSync('yarn', ['--version'], {
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
