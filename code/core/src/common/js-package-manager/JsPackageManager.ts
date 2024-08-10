import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import chalk from 'chalk';
import type { CommonOptions } from 'execa';
import { execaCommand, execaCommandSync } from 'execa';
import { gt, satisfies } from 'semver';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { HandledError } from '../utils/HandledError';
import storybookPackagesVersions from '../versions';
import type { PackageJson, PackageJsonWithDepsAndDevDeps } from './PackageJson';
import type { InstallationMetadata } from './types';

const logger = console;

export type PackageManagerName = 'npm' | 'yarn1' | 'yarn2' | 'pnpm';

type StorybookPackage = keyof typeof storybookPackagesVersions;

/**
 * Extract package name and version from input
 *
 * @param pkg A string like `@storybook/cli`, `react` or `react@^16`
 * @return A tuple of 2 elements: [packageName, packageVersion]
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

  public abstract initPackageJson(): Promise<void>;

  public abstract getRunStorybookCommand(): string;

  public abstract getRunCommand(command: string): string;

  public readonly cwd?: string;

  public abstract getPackageJSON(
    packageName: string,
    basePath?: string
  ): Promise<PackageJson | null>;

  /**
   * Get the INSTALLED version of a package from the package.json file
   */
  async getPackageVersion(packageName: string, basePath = this.cwd): Promise<string | null> {
    const packageJSON = await this.getPackageJSON(packageName, basePath);
    return packageJSON ? packageJSON.version ?? null : null;
  }

  constructor(options?: JsPackageManagerOptions) {
    this.cwd = options?.cwd || process.cwd();
  }

  /** Detect whether Storybook gets initialized in a monorepository/workspace environment
   * The cwd doesn't have to be the root of the monorepo, it can be a subdirectory
   * @returns true, if Storybook is initialized inside a monorepository/workspace
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

  /**
   * Install dependencies listed in `package.json`
   */
  public async installDependencies() {
    logger.log('Installing dependencies...');
    logger.log();

    try {
      await this.runInstall();
    } catch (e) {
      logger.error('An error occurred while installing dependencies.');
      throw new HandledError(e);
    }
  }

  packageJsonPath(): string {
    if (!this.cwd) {
      throw new Error('Missing cwd');
    }
    return resolve(this.cwd, 'package.json');
  }

  async readPackageJson(): Promise<PackageJson> {
    const packageJsonPath = this.packageJsonPath();
    if (!existsSync(packageJsonPath)) {
      throw new Error(`Could not read package.json file at ${packageJsonPath}`);
    }

    const jsonContent = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(jsonContent);
  }

  async writePackageJson(packageJson: PackageJson) {
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
    await writeFile(this.packageJsonPath(), content, 'utf8');
  }

  /**
   * Read the `package.json` file available in the directory the command was call from
   * If there is no `package.json` it will create one.
   */
  public async retrievePackageJson(): Promise<PackageJsonWithDepsAndDevDeps> {
    let packageJson;
    try {
      packageJson = await this.readPackageJson();
    } catch (err) {
      const errMessage = String(err);
      if (errMessage.includes('Could not read package.json')) {
        await this.initPackageJson();
        packageJson = await this.readPackageJson();
      } else {
        throw new Error(
          dedent`
            There was an error while reading the package.json file at ${this.packageJsonPath()}: ${errMessage}
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
   * @param {Object} options contains `skipInstall`, `packageJson` and `installAsDevDependencies` which we use to determine how we install packages.
   * @param {Array} dependencies contains a list of packages to add.
   * @example
   * addDependencies(options, [
   *   `@storybook/react@${storybookVersion}`,
   *   `@storybook/addon-actions@${actionsVersion}`,
   *   `@storybook/addon-links@${linksVersion}`,
   *   `@storybook/preview-api@${addonsVersion}`,
   * ]);
   */
  public async addDependencies(
    options: {
      skipInstall?: boolean;
      installAsDevDependencies?: boolean;
      packageJson?: PackageJson;
    },
    dependencies: string[]
  ) {
    const { skipInstall } = options;

    if (skipInstall) {
      const { packageJson } = options;
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
      await this.writePackageJson(packageJson);
    } else {
      try {
        await this.runAddDeps(dependencies, Boolean(options.installAsDevDependencies));
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
   * @param {Object} options contains `skipInstall`, `packageJson` and `installAsDevDependencies` which we use to determine how we install packages.
   * @param {Array} dependencies contains a list of packages to remove.
   * @example
   * removeDependencies(options, [
   *   `@storybook/react`,
   *   `@storybook/addon-actions`,
   * ]);
   */
  public async removeDependencies(
    options: {
      skipInstall?: boolean;
      packageJson?: PackageJson;
    },
    dependencies: string[]
  ): Promise<void> {
    const { skipInstall } = options;

    if (skipInstall) {
      const { packageJson } = options;

      invariant(packageJson, 'Missing packageJson.');
      dependencies.forEach((dep) => {
        if (packageJson.devDependencies) {
          delete packageJson.devDependencies[dep];
        }
        if (packageJson.dependencies) {
          delete packageJson.dependencies[dep];
        }
      });

      await this.writePackageJson(packageJson);
    } else {
      try {
        await this.runRemoveDeps(dependencies);
      } catch (e) {
        logger.error('An error occurred while removing dependencies.');
        logger.log(String(e));
        throw new HandledError(e);
      }
    }
  }

  /**
   * Return an array of strings matching following format: `<package_name>@<package_latest_version>`
   *
   * For packages in the storybook monorepo, when the latest version is equal to the version of the current CLI
   * the version is not added to the string.
   *
   * When a package is in the monorepo, and the version is not equal to the CLI version, the version is taken from the versions.ts file and added to the string.
   *
   * @param packages
   */
  public getVersionedPackages(packages: string[]): Promise<string[]> {
    return Promise.all(
      packages.map(async (pkg) => {
        const [packageName, packageVersion] = getPackageDetails(pkg);
        const latestInRange = await this.latestVersion(packageName, packageVersion);

        const k = packageName as keyof typeof storybookPackagesVersions;
        const currentVersion = storybookPackagesVersions[k];

        if (currentVersion === latestInRange) {
          return `${packageName}`;
        }
        if (currentVersion) {
          return `${packageName}@${currentVersion}`;
        }
        return `${packageName}@^${latestInRange}`;
      })
    );
  }

  /**
   * Return an array of string standing for the latest version of the input packages.
   * To be able to identify which version goes with which package the order of the input array is keep.
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
   * Return the latest version of the input package available on npmjs registry.
   * If constraint are provided it return the latest version matching the constraints.
   *
   * For `@storybook/*` packages the latest version is retrieved from `cli/src/versions.json` file directly
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
        logger.warn(`\n     ${chalk.yellow(String(e))}`);
        return current;
      }

      logger.error(`\n     ${chalk.red(String(e))}`);
      throw new HandledError(e);
    }

    const versionToUse =
      current && (!constraint || satisfies(current, constraint)) && gt(current, latest)
        ? current
        : latest;
    return `^${versionToUse}`;
  }

  /**
   * Get the latest version of the package available on npmjs.com.
   * If constraint is set then it returns a version satisfying it, otherwise the latest version available is returned.
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
      'No version satisfying the constraint.'
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

  public async addScripts(scripts: Record<string, string>) {
    const packageJson = await this.retrievePackageJson();
    await this.writePackageJson({
      ...packageJson,
      scripts: {
        ...packageJson.scripts,
        ...scripts,
      },
    });
  }

  public async addPackageResolutions(versions: Record<string, string>) {
    const packageJson = await this.retrievePackageJson();
    const resolutions = this.getResolutions(packageJson, versions);
    this.writePackageJson({ ...packageJson, ...resolutions });
  }

  protected abstract runInstall(): Promise<void>;

  protected abstract runAddDeps(
    dependencies: string[],
    installAsDevDependencies: boolean
  ): Promise<void>;

  protected abstract runRemoveDeps(dependencies: string[]): Promise<void>;

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
        env,
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
   * Returns the installed (within node_modules or pnp zip) version of a specified package
   */
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
        env,
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
}
