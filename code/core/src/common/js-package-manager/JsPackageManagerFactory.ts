import { detect } from 'package-manager-detector/detect';

import { BUNProxy } from './BUNProxy';
import type { JsPackageManager, PackageManagerName } from './JsPackageManager';
import { NPMProxy } from './NPMProxy';
import { PNPMProxy } from './PNPMProxy';
import { Yarn1Proxy } from './Yarn1Proxy';
import { Yarn2Proxy } from './Yarn2Proxy';

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
  public static async getPackageManagerType(cwd = process.cwd()): Promise<PackageManagerName> {
    const pm = await detect({ cwd });

    switch (pm?.name) {
      case 'yarn':
        return pm.agent.includes('berry') ? 'yarn2' : 'yarn1';
      case 'deno':
        return 'npm';
      case undefined:
        throw new Error(
          'Unable to find a usable package manager within NPM, PNPM, Yarn and Yarn 2'
        );
      default:
        return pm?.name || 'npm';
    }
  }

  public static async getPackageManager(
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
  ): Promise<JsPackageManager> {
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
    const packageManagerType = await this.getPackageManagerType(cwd);
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
}
