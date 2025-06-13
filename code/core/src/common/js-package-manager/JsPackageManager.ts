import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { logger, prompt } from 'storybook/internal/node-logger';

// eslint-disable-next-line depend/ban-dependencies
import { type CommonOptions, type ExecaChildProcess, execa, execaCommandSync } from 'execa';
import { findUpMultipleSync, findUpSync } from 'find-up';
// eslint-disable-next-line depend/ban-dependencies
import { globSync } from 'glob';
import picocolors from 'picocolors';
import { gt, satisfies } from 'semver';
import invariant from 'tiny-invariant';

import { HandledError } from '../utils/HandledError';
import { getProjectRoot } from '../utils/paths';
import storybookPackagesVersions from '../versions';
import type { PackageJson, PackageJsonWithDepsAndDevDeps } from './PackageJson';
import type { InstallationMetadata } from './types';

export type PackageManagerName = 'npm' | 'yarn1' | 'yarn2' | 'pnpm' | 'bun';

type StorybookPackage = keyof typeof storybookPackagesVersions;

export const COMMON_ENV_VARS = {
  COREPACK_ENABLE_STRICT: '0',
  COREPACK_ENABLE_AUTO_PIN: '0',
  NO_UPDATE_NOTIFIER: 'true',
};

/**
 * Extract package name and version from input
 *
 * @param pkg A string like `@storybook/cli`, `react` or `react@^16`
 * @returns A tuple of 2 elements: [packageName, packageVersion]
 */
export function getPackageDetails(pkg: string): [string, string?] {
  const idx = pkg.lastIndexOf('@');
  // If the only `@` is the first character, it is a scoped package
  // If it isn't in the string, it will be -1
  if (idx <= 0) {
    return [pkg, undefined];
  }
  const packageName = pkg.slice(0, idx);
  const packageVersion = pkg.slice(idx + 1);
  return [packageName, packageVersion];
}

interface JsPackageManagerOptions {
  cwd?: string;
  configDir?: string;
  // The storiesPaths can be provided to properly calculate the location of all relevant package.json files
  storiesPaths?: string[];
}

export type PackageJsonInfo = {
  packageJsonPath: string;
  operationDir: string;
  packageJson: PackageJsonWithDepsAndDevDeps;
};

export abstract class JsPackageManager {
  abstract readonly type: PackageManagerName;

  /** The path to the primary package.json file (contains the `storybook` dependency). */
  readonly primaryPackageJson: PackageJsonInfo;

  /** The paths to all package.json files in the project root. */
  packageJsonPaths: string[];

  /**
   * The path to the Storybook instance directory. This is used to find the primary package.json
   * file in a repository.
   */
  readonly instanceDir: string;

  /** The current working directory. */
  protected readonly cwd: string;

  /** Cache for latest version results to avoid repeated network calls. */
  static readonly latestVersionCache = new Map<string, string | null>();

  /** Cache for installed version results to avoid repeated file system calls. */
  static readonly installedVersionCache = new Map<string, string | null>();

  constructor(options?: JsPackageManagerOptions) {
    this.cwd = options?.cwd || process.cwd();
    this.instanceDir = options?.configDir
      ? isAbsolute(options?.configDir)
        ? dirname(options?.configDir)
        : dirname(join(this.cwd, options?.configDir))
      : this.cwd;
    this.packageJsonPaths = JsPackageManager.listAllPackageJsonPaths(
      this.instanceDir,
      options?.storiesPaths
    );
    this.primaryPackageJson = this.#getPrimaryPackageJson();
  }

  /** Runs arbitrary package scripts. */
  abstract getRunCommand(command: string): string;
  /**
   * Run a command from a local or remote. Fetches a package from the registry without installing it
   * as a dependency, hotloads it, and runs whatever default command binary it exposes.
   */
  abstract getRemoteRunCommand(pkg: string, args: string[], specifier?: string): string;

  /** Get the package.json file for a given module. */
  abstract getModulePackageJSON(packageName: string): PackageJson | null;

  isStorybookInMonorepo() {
    const turboJsonPath = findUpSync(`turbo.json`, { stopAt: getProjectRoot() });
    const rushJsonPath = findUpSync(`rush.json`, { stopAt: getProjectRoot() });
    const nxJsonPath = findUpSync(`nx.json`, { stopAt: getProjectRoot() });

    if (turboJsonPath || rushJsonPath || nxJsonPath) {
      return true;
    }

    const packageJsonPaths = findUpMultipleSync(`package.json`, { stopAt: getProjectRoot() });
    if (packageJsonPaths.length === 0) {
      return false;
    }

    for (const packageJsonPath of packageJsonPaths) {
      const packageJsonFile = readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageJsonFile) as PackageJsonWithDepsAndDevDeps;

      if (packageJson.workspaces) {
        return true;
      }
    }

    return false;
  }

  async installDependencies() {
    await prompt.executeTask(() => this.runInstall(), {
      id: 'install-dependencies',
      intro: 'Installing dependencies...',
      error: 'An error occurred while installing dependencies.',
      success: 'Dependencies installed',
    });

    // Clear installed version cache after installation
    this.clearInstalledVersionCache();
  }

  async dedupeDependencies() {
    await prompt.executeTask(() => this.runInternalCommand('dedupe', [], this.cwd), {
      id: 'dedupe-dependencies',
      intro: 'Deduplicating dependencies...',
      error: 'An error occurred while deduplicating dependencies.',
      success: 'Dependencies deduplicated',
    });

    // Clear installed version cache after installation
    this.clearInstalledVersionCache();
  }

  /** Read the `package.json` file available in the provided directory */
  static getPackageJson(packageJsonPath: string): PackageJsonWithDepsAndDevDeps {
    const jsonContent = readFileSync(packageJsonPath, 'utf8');
    const packageJSON = JSON.parse(jsonContent);

    return {
      ...packageJSON,
      dependencies: { ...packageJSON.dependencies },
      devDependencies: { ...packageJSON.devDependencies },
      peerDependencies: { ...packageJSON.peerDependencies },
    };
  }

  writePackageJson(packageJson: PackageJson, directory = this.cwd) {
    const packageJsonToWrite = { ...packageJson };
    const dependencyTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

    // Remove empty dependency objects
    dependencyTypes.forEach((type) => {
      if (packageJsonToWrite[type] && Object.keys(packageJsonToWrite[type]).length === 0) {
        delete packageJsonToWrite[type];
      }
    });

    const content = `${JSON.stringify(packageJsonToWrite, null, 2)}\n`;
    writeFileSync(resolve(directory, 'package.json'), content, 'utf8');
  }

  getAllDependencies() {
    const allDependencies: Record<string, string> = {};

    for (const packageJsonPath of this.packageJsonPaths) {
      const packageJson = JsPackageManager.getPackageJson(packageJsonPath);
      const { dependencies, devDependencies, peerDependencies } = packageJson;

      Object.assign(allDependencies, dependencies, devDependencies, peerDependencies);
    }

    return allDependencies;
  }

  isDependencyInstalled(dependency: string) {
    return Object.keys(this.getAllDependencies()).includes(dependency);
  }

  /**
   * Add dependencies to a project using `yarn add` or `npm install`.
   *
   * @example
   *
   * ```ts
   * addDependencies(options, [
   *   `@storybook/react@${storybookVersion}`,
   *   `@storybook/addon-links@${linksVersion}`,
   * ]);
   * ```
   *
   * @param {Object} options Contains `skipInstall`, `packageJson` and `installAsDevDependencies`
   *   which we use to determine how we install packages.
   * @param {Array} dependencies Contains a list of packages to add.
   */
  public async addDependencies(
    options:
      | {
          skipInstall: true;
          type: 'dependencies' | 'devDependencies' | 'peerDependencies';
          writeOutputToFile?: boolean;
          packageJsonInfo?: PackageJsonInfo;
        }
      | {
          skipInstall?: false;
          type: 'dependencies' | 'devDependencies';
          writeOutputToFile?: boolean;
          packageJsonInfo?: PackageJsonInfo;
        },
    dependencies: string[]
  ): Promise<void | ExecaChildProcess> {
    const {
      skipInstall,
      writeOutputToFile = true,
      packageJsonInfo = this.primaryPackageJson,
    } = options;

    if (skipInstall) {
      const { operationDir, packageJson } = packageJsonInfo;
      const dependenciesMap: Record<string, string> = {};

      for (const dep of dependencies) {
        const [packageName, packageVersion] = getPackageDetails(dep);
        const latestVersion = await this.getVersion(packageName);
        dependenciesMap[packageName] = packageVersion ?? latestVersion;
      }

      const targetDeps = packageJson[options.type] as Record<string, string>;

      Object.assign(targetDeps, dependenciesMap);
      this.writePackageJson(packageJson, operationDir);
    } else {
      try {
        const result = this.runAddDeps(
          dependencies,
          Boolean(options.type === 'devDependencies'),
          writeOutputToFile
        );

        // Clear installed version cache after adding dependencies
        this.clearInstalledVersionCache();

        return result;
      } catch (e: any) {
        logger.error('\nAn error occurred while installing dependencies:');
        logger.log(e.message);
        throw new HandledError(e);
      }
    }
  }

  /**
   * Removing dependencies from the package.json file, which is found first starting from the
   * instance root. The method does not run a package manager install like `npm install`.
   *
   * @example
   *
   * ```ts
   * removeDependencies([`@storybook/react`]);
   * ```
   *
   * @param dependencies Contains a list of packages to remove.
   */
  async removeDependencies(dependencies: string[]): Promise<void> {
    for (const pjPath of this.packageJsonPaths) {
      try {
        const packageJson = JsPackageManager.getPackageJson(pjPath);
        let modified = false;
        dependencies.forEach((dep) => {
          if (packageJson.dependencies && packageJson.dependencies[dep]) {
            delete packageJson.dependencies[dep];
            modified = true;
          }
          if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
            delete packageJson.devDependencies[dep];
            modified = true;
          }
          if (packageJson.peerDependencies && packageJson.peerDependencies[dep]) {
            delete packageJson.peerDependencies[dep];
            modified = true;
          }
        });
        if (modified) {
          this.writePackageJson(packageJson, dirname(pjPath));
          break;
        }
      } catch (e) {
        logger.warn(`Could not process ${pjPath} for dependency removal: ${String(e)}`);
      }
    }
  }

  /**
   * Return an array of strings matching following format: `<package_name>@<package_latest_version>`
   *
   * For packages in the storybook monorepo, when the latest version is equal to the version of the
   * current CLI the version is not added to the string.
   *
   * When a package is in the monorepo, and the version is not equal to the CLI version, the version
   * is taken from the versions.ts file and added to the string.
   *
   * @param packages
   */
  public getVersionedPackages(packages: string[]): Promise<string[]> {
    return Promise.all(
      packages.map(async (pkg) => {
        const [packageName, packageVersion] = getPackageDetails(pkg);

        // If the packageVersion is specified and we are not dealing with a storybook package,
        // just return the requested version.
        if (packageVersion && !(packageName in storybookPackagesVersions)) {
          return pkg;
        }

        const latestInRange = await this.latestVersion(packageName, packageVersion);

        const k = packageName as keyof typeof storybookPackagesVersions;
        const currentVersion = storybookPackagesVersions[k];

        const isLatestStableRelease = currentVersion === latestInRange;

        if (isLatestStableRelease || !currentVersion) {
          return `${packageName}@^${latestInRange}`;
        }

        return `${packageName}@${currentVersion}`;
      })
    );
  }

  /**
   * Return an array of string standing for the latest version of the input packages. To be able to
   * identify which version goes with which package the order of the input array is keep.
   *
   * @param packageNames
   */
  public getVersions(...packageNames: string[]): Promise<string[]> {
    return Promise.all(
      packageNames.map((packageName) => {
        return this.getVersion(packageName);
      })
    );
  }

  /**
   * Return the latest version of the input package available on npmjs registry. If constraint are
   * provided it return the latest version matching the constraints.
   *
   * For `@storybook/*` packages the latest version is retrieved from `cli/src/versions.json` file
   * directly
   *
   * @param packageName The name of the package
   * @param constraint A valid semver constraint, example: '1.x || >=2.5.0 || 5.0.0 - 7.2.3'
   */
  public async getVersion(packageName: string, constraint?: string): Promise<string> {
    let current: string | undefined;

    if (packageName in storybookPackagesVersions) {
      current = storybookPackagesVersions[packageName as StorybookPackage];
    }

    let latest;
    try {
      latest = await this.latestVersion(packageName, constraint);
      if (!latest) {
        throw new Error(`No version found for ${packageName}`);
      }
    } catch (e) {
      if (current) {
        logger.warn(`\n     ${picocolors.yellow(String(e))}`);
        return current;
      }

      logger.error(`\n     ${picocolors.red(String(e))}`);
      throw new HandledError(e);
    }

    const versionToUse =
      current && (!constraint || satisfies(current, constraint)) && gt(current, latest)
        ? current
        : latest;
    return `^${versionToUse}`;
  }

  /**
   * Get the latest version of the package available on npmjs.com. If constraint is set then it
   * returns a version satisfying it, otherwise the latest version available is returned.
   *
   * @param packageName Name of the package
   * @param constraint Version range to use to constraint the returned version
   */
  public async latestVersion(packageName: string, constraint?: string): Promise<string | null> {
    // Create cache key that includes both package name and constraint
    const cacheKey = constraint ? `${packageName}@${constraint}` : packageName;

    // Check cache first
    const cachedVersion = JsPackageManager.latestVersionCache.get(cacheKey);
    if (cachedVersion) {
      logger.debug(`Using cached version for ${packageName}...`);
      return cachedVersion;
    }

    let result: string;

    logger.debug(`Getting CLI versions from NPM for ${packageName}...`);
    try {
      if (!constraint) {
        result = await this.runGetVersions(packageName, false);
      } else {
        const versions = await this.runGetVersions(packageName, true);

        const latestVersionSatisfyingTheConstraint = versions
          .reverse()
          .find((version) => satisfies(version, constraint));

        invariant(
          latestVersionSatisfyingTheConstraint != null,
          `No version satisfying the constraint: ${packageName}${constraint}`
        );
        result = latestVersionSatisfyingTheConstraint;
      }

      // Cache the result before returning
      JsPackageManager.latestVersionCache.set(cacheKey, result);
      return result;
    } catch (e) {
      JsPackageManager.latestVersionCache.set(cacheKey, null);
      return null;
    }
  }

  /**
   * Clear the latest version cache. Useful for testing or when you want to refresh version
   * information.
   *
   * @param packageName Optional package name to clear only specific entries. If not provided,
   *   clears all cache.
   */
  public static clearLatestVersionCache(packageName?: string): void {
    if (packageName) {
      // Clear all cache entries for this package (both with and without constraints)
      const keysToDelete = Array.from(JsPackageManager.latestVersionCache.keys()).filter(
        (key) => key === packageName || key.startsWith(`${packageName}@`)
      );
      keysToDelete.forEach((key) => JsPackageManager.latestVersionCache.delete(key));
    } else {
      // Clear all cache
      JsPackageManager.latestVersionCache.clear();
    }
  }

  /**
   * Clear the installed version cache for a specific package or all packages.
   *
   * @param packageName Optional package name to clear from cache. If not provided, clears all.
   */
  public clearInstalledVersionCache(packageName?: string): void {
    if (packageName) {
      // Clear all cache entries for this package across all working directories
      const keysToDelete = Array.from(JsPackageManager.installedVersionCache.keys()).filter((key) =>
        key.endsWith(`::${packageName}`)
      );
      keysToDelete.forEach((key) => JsPackageManager.installedVersionCache.delete(key));
    } else {
      JsPackageManager.installedVersionCache.clear();
    }
  }

  /**
   * Clear both the latest version cache and installed version cache. This should be called after
   * any operation that modifies dependencies.
   */
  public clearAllVersionCaches(): void {
    JsPackageManager.clearLatestVersionCache();
    this.clearInstalledVersionCache();
  }

  public addStorybookCommandInScripts(options?: { port: number; preCommand?: string }) {
    const sbPort = options?.port ?? 6006;
    const storybookCmd = `storybook dev -p ${sbPort}`;
    const buildStorybookCmd = `storybook build`;

    const preCommand = options?.preCommand ? this.getRunCommand(options.preCommand) : undefined;

    this.addScripts({
      storybook: [preCommand, storybookCmd].filter(Boolean).join(' && '),
      'build-storybook': [preCommand, buildStorybookCmd].filter(Boolean).join(' && '),
    });
  }

  public addScripts(scripts: Record<string, string>) {
    const { operationDir, packageJson } = this.#getPrimaryPackageJson();

    this.writePackageJson(
      {
        ...packageJson,
        scripts: {
          ...packageJson.scripts,
          ...scripts,
        },
      },
      operationDir
    );
  }

  public addPackageResolutions(versions: Record<string, string>) {
    const { operationDir, packageJson } = this.#getPrimaryPackageJson();

    const resolutions = this.getResolutions(packageJson, versions);
    this.writePackageJson({ ...packageJson, ...resolutions }, operationDir);
  }
  protected abstract runInstall(): ExecaChildProcess;

  protected abstract runAddDeps(
    dependencies: string[],
    installAsDevDependencies: boolean,
    writeOutputToFile?: boolean
  ): ExecaChildProcess;

  protected abstract getResolutions(
    packageJson: PackageJson,
    versions: Record<string, string>
  ): Record<string, any>;

  /**
   * Get the latest or all versions of the input package available on npmjs.com
   *
   * @param packageName Name of the package
   * @param fetchAllVersions Should return
   */
  protected abstract runGetVersions<T extends boolean>(
    packageName: string,
    fetchAllVersions: T
  ): // Use generic and conditional type to force `string[]` if fetchAllVersions is true and `string` if false
  Promise<T extends true ? string[] : string>;

  public abstract getRegistryURL(): Promise<string | undefined>;

  public abstract runInternalCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe' | 'ignore'
  ): ExecaChildProcess;
  public abstract runPackageCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe' | 'ignore'
  ): ExecaChildProcess;
  public abstract runPackageCommandSync(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe' | 'ignore'
  ): string;
  public abstract findInstallations(pattern?: string[]): Promise<InstallationMetadata | undefined>;
  public abstract findInstallations(
    pattern?: string[],
    options?: { depth: number }
  ): Promise<InstallationMetadata | undefined>;
  public abstract parseErrorFromLogs(logs?: string): string;

  public executeCommandSync({
    command,
    args = [],
    stdio,
    cwd,
    ignoreError = false,
    env,
    ...execaOptions
  }: CommonOptions<'utf8'> & {
    command: string;
    args: string[];
    cwd?: string;
    ignoreError?: boolean;
  }): string {
    try {
      const commandResult = execaCommandSync([command, ...args].join(' '), {
        cwd: cwd ?? this.cwd,
        stdio: stdio ?? 'pipe',
        shell: true,
        cleanup: true,
        env: {
          ...COMMON_ENV_VARS,
          ...env,
        },
        ...execaOptions,
      });

      return commandResult.stdout ?? '';
    } catch (err) {
      if (ignoreError !== true) {
        throw err;
      }
      return '';
    }
  }

  /**
   * Execute a command asynchronously and return the execa process. This allows you to hook into
   * stdout/stderr streams and monitor the process.
   *
   * @example Const process = packageManager.executeCommand({ command: 'npm', args: ['install'] });
   * process.stdout?.on('data', (data) => console.log(data.toString())); const result = await
   * process;
   */
  public executeCommand({
    command,
    args = [],
    stdio,
    cwd,
    ignoreError = false,
    env,
    ...execaOptions
  }: CommonOptions<'utf8'> & {
    command: string;
    args: string[];
    cwd?: string;
    ignoreError?: boolean;
  }): ExecaChildProcess {
    const execaProcess = execa([command, ...args].join(' '), {
      cwd: cwd ?? this.cwd,
      stdio: stdio ?? 'pipe',
      encoding: 'utf8',
      shell: true,
      cleanup: true,
      env: {
        ...COMMON_ENV_VARS,
        ...env,
      },
      ...execaOptions,
    });

    // If ignoreError is true, catch and suppress errors
    if (ignoreError) {
      execaProcess.catch((err) => {
        // Silently ignore errors when ignoreError is true
      });
    }

    return execaProcess;
  }

  /** Returns the installed (within node_modules or pnp zip) version of a specified package */
  public async getInstalledVersion(packageName: string): Promise<string | null> {
    const cacheKey = packageName;

    try {
      // Create cache key that includes both working directory and package name for isolation

      // Check cache first
      const cachedVersion = JsPackageManager.installedVersionCache.get(cacheKey);
      if (cachedVersion !== undefined) {
        logger.debug(`Using cached installed version for ${packageName}...`);
        return cachedVersion;
      }

      logger.debug(`Getting installed version for ${packageName}...`);
      const installations = await this.findInstallations([packageName]);
      if (!installations) {
        // Cache the null result
        JsPackageManager.installedVersionCache.set(cacheKey, null);
        return null;
      }

      const version = Object.entries(installations.dependencies)[0]?.[1]?.[0].version || null;

      // Cache the result
      JsPackageManager.installedVersionCache.set(cacheKey, version);

      return version;
    } catch (e) {
      JsPackageManager.installedVersionCache.set(cacheKey, null);
      return null;
    }
  }

  public async isPackageInstalled(packageName: string): Promise<boolean> {
    const version = await this.getInstalledVersion(packageName);
    return version !== null;
  }

  /**
   * Searches for a dependency/devDependency in all package.json files and returns the version of
   * the dependency.
   */
  public getDependencyVersion(dependency: string): string | null {
    const dependencyVersion = this.packageJsonPaths
      .map((path) => {
        const packageJson = JsPackageManager.getPackageJson(path);
        return packageJson.dependencies?.[dependency] ?? packageJson.devDependencies?.[dependency];
      })
      .filter(Boolean);
    return dependencyVersion[0] ?? null;
  }

  // Helper to read and check a package.json for storybook dependency
  static hasStorybookDependency(packageJsonPath: string): boolean {
    try {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJsonWithDepsAndDevDeps;
      return !!(
        (packageJson.dependencies && packageJson.dependencies.storybook) ||
        (packageJson.devDependencies && packageJson.devDependencies.storybook)
      );
    } catch (error) {
      return false; // If file doesn't exist or is unreadable, or JSON is invalid
    }
  }

  // Helper to read and check a package.json for storybook dependency
  static hasAnyStorybookDependency(packageJsonPath: string): boolean {
    try {
      const content = readFileSync(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJsonWithDepsAndDevDeps;
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return Object.keys(allDeps).some((dep) => dep.includes('storybook'));
    } catch (error) {
      return false; // If file doesn't exist or is unreadable, or JSON is invalid
    }
  }

  /**
   * Find the primary package.json file in the project root. The primary package.json file is the
   * one that contains the `storybook` dependency. If no primary package.json file is found, the
   * function will return the package.json file in the project root.
   */
  #findPrimaryPackageJsonPath(): string {
    for (const packageJsonPath of this.packageJsonPaths) {
      const hasStorybook = JsPackageManager.hasStorybookDependency(packageJsonPath);
      if (hasStorybook) {
        return packageJsonPath;
      }
    }

    // Fall back to cwd package.json
    return this.packageJsonPaths[0] ?? resolve(this.cwd, 'package.json');
  }

  /** List all package.json files starting from the given directory and stopping at the project root. */
  static listAllPackageJsonPaths(instanceDir: string, storiesPaths?: string[]): string[] {
    const packageJsonPaths = findUpMultipleSync('package.json', {
      cwd: instanceDir,
      stopAt: getProjectRoot(),
    });

    if (!storiesPaths) {
      return packageJsonPaths;
    }

    // 1. Find all package.json files starting from the project root
    const projectRoot = getProjectRoot();
    const allPackageJsonFiles = globSync('**/package.json', {
      cwd: projectRoot,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });

    // 2. Only keep the ones that are parents of at least one of the storiesPaths
    const relevantPackageJsons = allPackageJsonFiles.filter((packageJsonPath) => {
      const packageDir = dirname(packageJsonPath);
      return storiesPaths.some((storyPath) => storyPath.startsWith(packageDir));
    });

    // 3. Return the list of package.json paths
    return Array.from(new Set([...packageJsonPaths, ...relevantPackageJsons]));
  }

  /**
   * Get the primary package.json file and its operation directory. The primary package.json file is
   * the one that contains the storybook dependency. If the primary package.json file is not found,
   * the function returns information about thepackage.json file in the current working directory.
   */
  #getPrimaryPackageJson(): {
    packageJsonPath: string;
    operationDir: string;
    packageJson: PackageJsonWithDepsAndDevDeps;
  } {
    const finalTargetPackageJsonPath = this.#findPrimaryPackageJsonPath();

    return JsPackageManager.getPackageJsonInfo(finalTargetPackageJsonPath);
  }

  static getPackageJsonInfo(packageJsonPath: string): PackageJsonInfo {
    const operationDir = dirname(packageJsonPath);
    return {
      packageJsonPath,
      operationDir,
      get packageJson() {
        return JsPackageManager.getPackageJson(packageJsonPath);
      },
    };
  }
}
