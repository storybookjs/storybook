import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join as pathJoin, resolve } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import { type CommonOptions, execaCommand, execaCommandSync } from 'execa';
import { findUpSync } from 'find-up';
// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import picocolors from 'picocolors';
import { gt, satisfies } from 'semver';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { HandledError } from '../utils/HandledError';
import { getProjectRoot } from '../utils/paths';
import storybookPackagesVersions from '../versions';
import type { PackageJson, PackageJsonWithDepsAndDevDeps } from './PackageJson';
import type { InstallationMetadata } from './types';

const logger = console;

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
}
export abstract class JsPackageManager {
  public abstract readonly type: PackageManagerName;

  public readonly projectRoot: string;
  private monorepoRootPackageJsonPath: string | null = null;
  public storybookInstanceDirs: string[];

  public abstract initPackageJson(): Promise<void>;

  public abstract getRunStorybookCommand(): string;

  public abstract getRunCommand(command: string): string;

  public abstract getRemoteRunCommand(): string;

  public readonly cwd?: string;

  public abstract getPackageJSON(
    packageName: string,
    basePath?: string
  ): Promise<PackageJson | null>;

  /** Get the INSTALLED version of a package from the package.json file */
  async getPackageVersion(packageName: string, basePath = this.cwd): Promise<string | null> {
    const packageJSON = await this.getPackageJSON(packageName, basePath);
    return packageJSON ? (packageJSON.version ?? null) : null;
  }

  constructor(options?: JsPackageManagerOptions) {
    this.cwd = options?.cwd || process.cwd();
    this.projectRoot = getProjectRoot();
    this.storybookInstanceDirs = [];
  }

  public async init() {
    this.monorepoRootPackageJsonPath = await this._getMonorepoRootPackageJsonPath(this.projectRoot);
    this.storybookInstanceDirs = await this.getAllStorybookInstances(this.projectRoot);
  }

  /**
   * Detect whether Storybook gets initialized in a mono-repository/workspace environment The cwd
   * doesn't have to be the root of the monorepo, it can be a subdirectory
   *
   * @returns `true`, if Storybook is initialized inside a mono-repository/workspace
   */
  public isStorybookInMonorepo() {
    let cwd = process.cwd();

    while (true) {
      try {
        const turboJsonPath = `${cwd}/turbo.json`;
        const rushJsonPath = `${cwd}/rush.json`;

        if (existsSync(turboJsonPath) || existsSync(rushJsonPath)) {
          return true;
        }

        const packageJsonPath = require.resolve(`${cwd}/package.json`);

        // read packagejson with readFileSync
        const packageJsonFile = readFileSync(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(packageJsonFile) as PackageJsonWithDepsAndDevDeps;

        if (packageJson.workspaces) {
          return true;
        }
      } catch (err) {
        // Package.json not found or invalid in current directory
      }

      // Move up to the parent directory
      const parentDir = dirname(cwd);

      // Check if we have reached the root of the filesystem
      if (parentDir === cwd) {
        break;
      }

      // Update cwd to the parent directory
      cwd = parentDir;
    }

    return false;
  }

  /** Install dependencies listed in `package.json` */
  public async installDependencies(installInDir?: string) {
    logger.log('Installing dependencies...');
    logger.log();
    const targetDir = installInDir || this.projectRoot;

    try {
      await this.runInstall(targetDir);
    } catch (e) {
      logger.error('An error occurred while installing dependencies.');
      throw new HandledError(e);
    }
  }

  packageJsonPath(directory?: string): string {
    const targetDir = directory || this.cwd;
    if (!targetDir) {
      throw new Error('Missing directory for package.json path');
    }
    return resolve(targetDir, 'package.json');
  }

  async readPackageJson(directory?: string): Promise<PackageJson> {
    const packageJsonPath = this.packageJsonPath(directory);
    if (!existsSync(packageJsonPath)) {
      throw new Error(`Could not read package.json file at ${packageJsonPath}`);
    }

    const jsonContent = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(jsonContent);
  }

  async writePackageJson(packageJson: PackageJson, directory?: string) {
    const packageJsonToWrite = { ...packageJson };
    // make sure to not accidentally add empty fields
    if (
      packageJsonToWrite.dependencies &&
      Object.keys(packageJsonToWrite.dependencies).length === 0
    ) {
      delete packageJsonToWrite.dependencies;
    }
    if (
      packageJsonToWrite.devDependencies &&
      Object.keys(packageJsonToWrite.devDependencies).length === 0
    ) {
      delete packageJsonToWrite.devDependencies;
    }
    if (
      packageJsonToWrite.peerDependencies &&
      Object.keys(packageJsonToWrite.peerDependencies).length === 0
    ) {
      delete packageJsonToWrite.peerDependencies;
    }

    const content = `${JSON.stringify(packageJsonToWrite, null, 2)}\n`;
    await writeFile(this.packageJsonPath(directory), content, 'utf8');
  }

  /**
   * Read the `package.json` file available in the directory the command was call from If there is
   * no `package.json` it will create one.
   */
  public async retrievePackageJson(directory?: string): Promise<PackageJsonWithDepsAndDevDeps> {
    let packageJson;
    try {
      packageJson = await this.readPackageJson(directory);
    } catch (err) {
      const errMessage = String(err);
      if (errMessage.includes('Could not read package.json')) {
        if (!directory) {
          await this.initPackageJson();
          packageJson = await this.readPackageJson(directory);
        } else {
          throw new Error(`Package.json not found in specified directory: ${directory}`);
        }
      } else {
        throw new Error(
          dedent`
            There was an error while reading the package.json file at ${this.packageJsonPath(directory)}: ${errMessage}
            Please fix the error and try again.
          `
        );
      }
    }

    return {
      ...packageJson,
      dependencies: { ...packageJson.dependencies },
      devDependencies: { ...packageJson.devDependencies },
      peerDependencies: { ...packageJson.peerDependencies },
    };
  }

  public async getAllDependencies(): Promise<Partial<Record<string, string>>> {
    const { dependencies, devDependencies, peerDependencies } = await this.retrievePackageJson();

    return {
      ...dependencies,
      ...devDependencies,
      ...peerDependencies,
    };
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
    options: {
      skipInstall?: boolean;
      installAsDevDependencies?: boolean;
      packageJson?: PackageJson;
      targetPackageJsonPath?: string;
      instanceDirForTargeting?: string;
      writeOutputToFile?: boolean;
    },
    dependencies: string[]
  ) {
    const {
      skipInstall,
      writeOutputToFile = true,
      targetPackageJsonPath: directTargetPath,
      instanceDirForTargeting,
    } = options;
    let { packageJson } = options;

    let finalTargetPackageJsonPath: string | null = directTargetPath ?? null;
    if (!finalTargetPackageJsonPath) {
      const dirToUse =
        instanceDirForTargeting ||
        (this.storybookInstanceDirs.length > 0 ? this.storybookInstanceDirs[0] : null);
      if (dirToUse) {
        finalTargetPackageJsonPath = await this.findPrimaryPackageJsonPath(
          dirToUse,
          this.projectRoot,
          this.monorepoRootPackageJsonPath
        );
      } else {
        finalTargetPackageJsonPath = this.monorepoRootPackageJsonPath;
      }

      if (!finalTargetPackageJsonPath) {
        finalTargetPackageJsonPath = this.packageJsonPath();
      }
    }

    if (!finalTargetPackageJsonPath) {
      throw new Error('Could not determine target package.json for addDependencies');
    }

    const operationDir = dirname(finalTargetPackageJsonPath);

    if (skipInstall) {
      if (!packageJson) {
        packageJson = await this.retrievePackageJson(operationDir);
      }
      invariant(packageJson, 'Missing packageJson.');

      const dependenciesMap = dependencies.reduce((acc, dep) => {
        const [packageName, packageVersion] = getPackageDetails(dep);
        return { ...acc, [packageName]: packageVersion };
      }, {});

      if (options.installAsDevDependencies) {
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          ...dependenciesMap,
        };
      } else {
        packageJson.dependencies = {
          ...packageJson.dependencies,
          ...dependenciesMap,
        };
      }
      await this.writePackageJson(packageJson, operationDir);
    } else {
      try {
        await this.runAddDeps(
          dependencies,
          Boolean(options.installAsDevDependencies),
          writeOutputToFile,
          operationDir
        );
      } catch (e: any) {
        logger.error('\nAn error occurred while installing dependencies:');
        logger.log(e.message);
        throw new HandledError(e);
      }
    }
  }

  /**
   * Remove dependencies from a project using `yarn remove` or `npm uninstall`.
   *
   * @example
   *
   * ```ts
   * removeDependencies(options, [`@storybook/react`]);
   * ```
   *
   * @param {Object} options Contains `skipInstall`, `packageJson` and `installAsDevDependencies`
   *   which we use to determine how we install packages.
   * @param {Array} dependencies Contains a list of packages to remove.
   */
  public async removeDependencies(
    options: {
      skipInstall?: boolean;
      packageJson?: PackageJson;
      targetPackageJsonPath?: string;
      removeGloballyIfNoTarget?: boolean;
    },
    dependencies: string[]
  ): Promise<void> {
    const { skipInstall, targetPackageJsonPath, removeGloballyIfNoTarget = true } = options;
    let { packageJson } = options;

    if (targetPackageJsonPath) {
      // If a specific target is provided, behave like before but on that target
      const operationDir = dirname(targetPackageJsonPath);
      if (skipInstall) {
        if (!packageJson) {
          packageJson = await this.retrievePackageJson(operationDir);
        }
        invariant(packageJson, 'Missing packageJson for removeDependencies with skipInstall.');

        dependencies.forEach((dep) => {
          if (packageJson.devDependencies) {
            delete packageJson.devDependencies[dep];
          }
          if (packageJson.dependencies) {
            delete packageJson.dependencies[dep];
          }
          // Also check peerDependencies as per plan
          if (packageJson.peerDependencies) {
            delete packageJson.peerDependencies[dep];
          }
        });
        await this.writePackageJson(packageJson, operationDir);
      } else {
        try {
          await this.runRemoveDeps(dependencies, operationDir);
        } catch (e) {
          logger.error(
            `An error occurred while removing dependencies from ${targetPackageJsonPath}.`
          );
          logger.log(String(e));
          throw new HandledError(e);
        }
      }
    } else if (removeGloballyIfNoTarget) {
      // Global removal only if flag is true
      // New behavior: remove from ALL package.jsons in the project root
      const allPackageJsonPaths = await this.listAllPackageJsonPaths(this.projectRoot);

      if (skipInstall) {
        for (const pjPath of allPackageJsonPaths) {
          try {
            const currentPackageJson = await this.retrievePackageJson(dirname(pjPath));
            let modified = false;
            dependencies.forEach((dep) => {
              if (currentPackageJson.dependencies && currentPackageJson.dependencies[dep]) {
                delete currentPackageJson.dependencies[dep];
                modified = true;
              }
              if (currentPackageJson.devDependencies && currentPackageJson.devDependencies[dep]) {
                delete currentPackageJson.devDependencies[dep];
                modified = true;
              }
              if (currentPackageJson.peerDependencies && currentPackageJson.peerDependencies[dep]) {
                delete currentPackageJson.peerDependencies[dep];
                modified = true;
              }
            });
            if (modified) {
              await this.writePackageJson(currentPackageJson, dirname(pjPath));
            }
          } catch (e) {
            logger.warn(`Could not process ${pjPath} for dependency removal: ${String(e)}`);
          }
        }
      } else {
        // If not skipInstall, and no targetPackageJsonPath, this implies a global uninstall.
        // Package managers like pnpm handle this with workspace commands (`pnpm -r remove X`).
        // For others, it might only affect the root/cwd. This part needs PM-specific logic.
        // For now, we make it explicit that this will run from projectRoot, and PMs need to implement `runRemoveDeps` accordingly.
        // This is a significant change from old behavior (this.cwd).
        try {
          // This will require PMs to implement runRemoveDeps to support workspace-wide removal if possible,
          // or document that it only affects the root if not.
          logger.info(
            `Attempting to remove dependencies [${dependencies.join(', ')}] from all relevant package.json files using package manager commands.`
          );
          await this.runRemoveDeps(dependencies, this.projectRoot);
        } catch (e) {
          logger.error('An error occurred while removing dependencies globally.');
          logger.log(String(e));
          throw new HandledError(e);
        }
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
  public async latestVersion(packageName: string, constraint?: string): Promise<string> {
    if (!constraint) {
      return this.runGetVersions(packageName, false);
    }

    const versions = await this.runGetVersions(packageName, true);

    const latestVersionSatisfyingTheConstraint = versions
      .reverse()
      .find((version) => satisfies(version, constraint));
    invariant(
      latestVersionSatisfyingTheConstraint != null,
      `No version satisfying the constraint: ${packageName}${constraint}`
    );
    return latestVersionSatisfyingTheConstraint;
  }

  public async addStorybookCommandInScripts(options?: { port: number; preCommand?: string }) {
    const sbPort = options?.port ?? 6006;
    const storybookCmd = `storybook dev -p ${sbPort}`;

    const buildStorybookCmd = `storybook build`;

    const preCommand = options?.preCommand ? this.getRunCommand(options.preCommand) : undefined;
    await this.addScripts({
      storybook: [preCommand, storybookCmd].filter(Boolean).join(' && '),
      'build-storybook': [preCommand, buildStorybookCmd].filter(Boolean).join(' && '),
    });
  }

  public async addScripts(
    scripts: Record<string, string>,
    targetOptions?: { targetPackageJsonPath?: string; instanceDirForTargeting?: string }
  ) {
    let finalTargetPackageJsonPath: string | null = targetOptions?.targetPackageJsonPath ?? null;

    if (!finalTargetPackageJsonPath) {
      const dirToUse =
        targetOptions?.instanceDirForTargeting ||
        (this.storybookInstanceDirs.length > 0 ? this.storybookInstanceDirs[0] : null);
      if (dirToUse) {
        finalTargetPackageJsonPath = await this.findPrimaryPackageJsonPath(
          dirToUse,
          this.projectRoot,
          this.monorepoRootPackageJsonPath
        );
      } else {
        finalTargetPackageJsonPath = this.monorepoRootPackageJsonPath;
      }

      if (!finalTargetPackageJsonPath) {
        finalTargetPackageJsonPath = this.packageJsonPath();
      }
    }

    if (!finalTargetPackageJsonPath) {
      throw new Error('Could not determine target package.json for addScripts');
    }
    const operationDir = dirname(finalTargetPackageJsonPath);
    const packageJson = await this.retrievePackageJson(operationDir);

    await this.writePackageJson(
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

  public async addPackageResolutions(
    versions: Record<string, string>,
    targetOptions?: { targetPackageJsonPath?: string; instanceDirForTargeting?: string }
  ) {
    let finalTargetPackageJsonPath: string | null = targetOptions?.targetPackageJsonPath ?? null;

    if (!finalTargetPackageJsonPath) {
      const dirToUse =
        targetOptions?.instanceDirForTargeting ||
        (this.storybookInstanceDirs.length > 0 ? this.storybookInstanceDirs[0] : null);
      if (dirToUse) {
        finalTargetPackageJsonPath = await this.findPrimaryPackageJsonPath(
          dirToUse,
          this.projectRoot,
          this.monorepoRootPackageJsonPath
        );
      } else {
        finalTargetPackageJsonPath = this.monorepoRootPackageJsonPath;
      }

      if (!finalTargetPackageJsonPath) {
        finalTargetPackageJsonPath = this.packageJsonPath();
      }
    }

    if (!finalTargetPackageJsonPath) {
      throw new Error('Could not determine target package.json for addPackageResolutions');
    }
    const operationDir = dirname(finalTargetPackageJsonPath);
    const packageJson = await this.retrievePackageJson(operationDir);
    const resolutions = this.getResolutions(packageJson, versions);
    await this.writePackageJson({ ...packageJson, ...resolutions }, operationDir);
  }

  protected abstract runInstall(cwd?: string): Promise<void>;

  protected abstract runAddDeps(
    dependencies: string[],
    installAsDevDependencies: boolean,
    writeOutputToFile?: boolean,
    cwd?: string
  ): Promise<void>;

  protected abstract runRemoveDeps(dependencies: string[], cwd?: string): Promise<void>;

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

  public abstract runPackageCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: string
  ): Promise<string>;
  public abstract runPackageCommandSync(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe'
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

  /** Returns the installed (within node_modules or pnp zip) version of a specified package */
  public async getInstalledVersion(packageName: string): Promise<string | null> {
    const installations = await this.findInstallations([packageName]);
    if (!installations) {
      return null;
    }

    return Object.entries(installations.dependencies)[0]?.[1]?.[0].version || null;
  }

  public async executeCommand({
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
  }): Promise<string> {
    try {
      const commandResult = await execaCommand([command, ...args].join(' '), {
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

      return commandResult.stdout ?? '';
    } catch (err) {
      if (ignoreError !== true) {
        throw err;
      }
      return '';
    }
  }

  private async _getMonorepoRootPackageJsonPath(projectRootDir: string): Promise<string | null> {
    if (!projectRootDir) {
      return null;
    }
    const packageJsonPath = pathJoin(projectRootDir, 'package.json');
    try {
      await readFile(packageJsonPath, 'utf-8');
      return packageJsonPath;
    } catch (error) {
      return null;
    }
  }

  // Helper to read and check a package.json for storybook dependency
  private async _readAndCheckStorybookDependency(packageJsonPath: string): Promise<boolean> {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJsonWithDepsAndDevDeps;
      return !!(
        (packageJson.dependencies && packageJson.dependencies['storybook']) ||
        (packageJson.devDependencies && packageJson.devDependencies['storybook'])
      );
    } catch (error) {
      return false; // If file doesn't exist or is unreadable, or JSON is invalid
    }
  }

  public async findPrimaryPackageJsonPath(
    instanceDir: string,
    projectRootDir: string,
    monorepoRootPackageJsonPath: string | null
  ): Promise<string | null> {
    if (!projectRootDir) {
      throw new Error('projectRootDir is required for findPrimaryPackageJsonPath');
    }

    // Scenario A: Centralized Management

    // Scenario A: Centralized Management
    if (monorepoRootPackageJsonPath) {
      const hasStorybookDep = await this._readAndCheckStorybookDependency(
        monorepoRootPackageJsonPath
      );
      if (hasStorybookDep) {
        return monorepoRootPackageJsonPath;
      }
    }

    // Scenario B: Decentralized or Localized Management
    let currentDir = instanceDir;
    const projectRootSegments = projectRootDir.replace(/\\$/, '').split(/[\\/]/).length;

    while (currentDir && currentDir.startsWith(projectRootDir)) {
      const currentDirSegments = currentDir.replace(/\\$/, '').split(/[\\/]/).length;

      if (currentDirSegments < projectRootSegments) {
        break;
      }

      const packageJsonPath = pathJoin(currentDir, 'package.json');
      try {
        await readFile(packageJsonPath, 'utf-8');
        const hasStorybookDep = await this._readAndCheckStorybookDependency(packageJsonPath);
        if (hasStorybookDep) {
          return packageJsonPath;
        }
      } catch (e) {
        /* ignore */
      }

      if (currentDir === projectRootDir) {
        break;
      }
      currentDir = dirname(currentDir);
    }

    if (monorepoRootPackageJsonPath) {
      return monorepoRootPackageJsonPath;
    }

    const instancePackageJsonPath = pathJoin(instanceDir, 'package.json');
    try {
      await readFile(instancePackageJsonPath, 'utf-8');
      return instancePackageJsonPath;
    } catch (error) {
      /* ignore */
    }

    return null;
  }

  // Added method to list all package.json paths in the project root
  private async listAllPackageJsonPaths(projectRootDir: string): Promise<string[]> {
    const rootDir = projectRootDir || this.projectRoot;

    if (!rootDir) {
      throw new Error('Project root not determined for listAllPackageJsonPaths');
    }

    const packageJsonPattern = '**/package.json';
    const ignoreDirPattern = '**/node_modules/**';
    const ensurePosixPath = (p: string) => p.split('\\').join('/');
    const posixRootDir = ensurePosixPath(rootDir);
    const posixIgnorePattern = ensurePosixPath(pathJoin(posixRootDir, ignoreDirPattern));

    const files = await globby(ensurePosixPath(packageJsonPattern), {
      cwd: posixRootDir,
      ignore: [posixIgnorePattern],
      absolute: true,
    });
    return files;
  }

  // --- Start of Public API methods for Monorepo Support ---

  public async getAllStorybookInstances(projectRootDir: string): Promise<string[]> {
    const rootDir = projectRootDir || this.projectRoot;

    if (!rootDir) {
      throw new Error('Project root not determined for getAllStorybookInstances');
    }

    const storybookDirPattern = '**/.storybook';
    const ignoreDirPattern = '**/node_modules/**';
    const ensurePosixPath = (p: string) => p.split('\\').join('/');
    const posixRootDir = ensurePosixPath(rootDir);
    const posixIgnorePattern = ensurePosixPath(pathJoin(posixRootDir, ignoreDirPattern));

    const files = await globby(ensurePosixPath(storybookDirPattern), {
      cwd: posixRootDir,
      ignore: [posixIgnorePattern],
      onlyDirectories: true,
      absolute: true,
    });
    return files.map((dir) => dirname(dir));
  }

  public async getMonorepoRootPackageJson(projectRootDir?: string): Promise<PackageJson | null> {
    const rootDir = projectRootDir || this.projectRoot;

    if (!rootDir) {
      return null;
    }
    const rootPackageJsonPath = await this._getMonorepoRootPackageJsonPath(rootDir);
    if (!rootPackageJsonPath) {
      return null;
    }
    try {
      return await this.readPackageJson(dirname(rootPackageJsonPath));
    } catch (e) {
      return null;
    }
  }

  public async getPrimaryPackageJsonForInstance(
    instanceDir: string,
    projectRootDir?: string
  ): Promise<PackageJson | null> {
    const rootDir = projectRootDir || this.projectRoot;

    if (!rootDir) {
      return null;
    }
    const monorepoRootPkgPath = await this._getMonorepoRootPackageJsonPath(rootDir);
    const primaryPath = await this.findPrimaryPackageJsonPath(
      instanceDir,
      rootDir,
      monorepoRootPkgPath
    );
    if (!primaryPath) {
      return null;
    }
    try {
      return await this.readPackageJson(dirname(primaryPath));
    } catch (e) {
      return null;
    }
  }

  public async listAllPackageJsonPaths(projectRootDir: string): Promise<string[]> {
    const rootDir = projectRootDir || this.projectRoot;

    if (!rootDir) {
      throw new Error('Project root not determined for listAllPackageJsonPaths');
    }

    const packageJsonPattern = '**/package.json';
    const ignoreDirPattern = '**/node_modules/**';
    const ensurePosixPath = (p: string) => p.split('\\').join('/');
    const posixRootDir = ensurePosixPath(rootDir);
    const posixIgnorePattern = ensurePosixPath(pathJoin(posixRootDir, ignoreDirPattern));

    const files = await globby(ensurePosixPath(packageJsonPattern), {
      cwd: posixRootDir,
      ignore: [posixIgnorePattern],
      absolute: true,
    });
    return files;
  }

  public async findPrimaryPackageJsonPath(
    instanceDir: string,
    projectRootDir: string,
    monorepoRootPackageJsonPath: string | null
  ): Promise<string | null> {
    if (!projectRootDir) {
      throw new Error('projectRootDir is required for findPrimaryPackageJsonPath');
    }

    // Scenario A: Centralized Management

    // Scenario A: Centralized Management
    if (monorepoRootPackageJsonPath) {
      const hasStorybookDep = await this._readAndCheckStorybookDependency(
        monorepoRootPackageJsonPath
      );
      if (hasStorybookDep) {
        return monorepoRootPackageJsonPath;
      }
    }

    // Scenario B: Decentralized or Localized Management
    let currentDir = instanceDir;
    const projectRootSegments = projectRootDir.replace(/\\$/, '').split(/[\\/]/).length;

    while (currentDir && currentDir.startsWith(projectRootDir)) {
      const currentDirSegments = currentDir.replace(/\\$/, '').split(/[\\/]/).length;

      if (currentDirSegments < projectRootSegments) {
        break;
      }

      const packageJsonPath = pathJoin(currentDir, 'package.json');
      try {
        await readFile(packageJsonPath, 'utf-8');
        const hasStorybookDep = await this._readAndCheckStorybookDependency(packageJsonPath);
        if (hasStorybookDep) {
          return packageJsonPath;
        }
      } catch (e) {
        /* ignore */
      }

      if (currentDir === projectRootDir) {
        break;
      }
      currentDir = dirname(currentDir);
    }

    if (monorepoRootPackageJsonPath) {
      return monorepoRootPackageJsonPath;
    }

    const instancePackageJsonPath = pathJoin(instanceDir, 'package.json');
    try {
      await readFile(instancePackageJsonPath, 'utf-8');
      return instancePackageJsonPath;
    } catch (error) {
      /* ignore */
    }

    return null;
  }

  // --- End of Public API methods for Monorepo Support ---

  // --- Start of Private Helper Methods ---
  private async _readAndCheckStorybookDependency(packageJsonPath: string): Promise<boolean> {
    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content) as PackageJsonWithDepsAndDevDeps;
      return !!(
        (packageJson.dependencies && packageJson.dependencies['storybook']) ||
        (packageJson.devDependencies && packageJson.devDependencies['storybook'])
      );
    } catch (error) {
      return false;
    }
  }

  private async _getMonorepoRootPackageJsonPath(projectRootDir: string): Promise<string | null> {
    if (!projectRootDir) {
      return null;
    }
    const packageJsonPath = pathJoin(projectRootDir, 'package.json');
    try {
      await readFile(packageJsonPath, 'utf-8');
      return packageJsonPath;
    } catch (error) {
      return null;
    }
  }
  // --- End of Private Helper Methods ---
}
