import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger, prompt } from 'storybook/internal/node-logger';
import {
  FindPackageVersionsError,
  MinimumReleaseAgeHandledError,
} from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ResultPromise } from 'execa';
import sort from 'semver/functions/sort.js';
import { dedent } from 'ts-dedent';

import type { ExecuteCommandOptions } from '../utils/command.ts';
import { executeCommand } from '../utils/command.ts';
import { getProjectRoot } from '../utils/paths.ts';
import {
  type InstallDependenciesOptions,
  JsPackageManager,
  PackageManagerName,
} from './JsPackageManager.ts';
import type { PackageJson } from './PackageJson.ts';
import type { InstallationMetadata, PackageMetadata } from './types.ts';
import {
  getAgeInMinutes,
  getErrorLogs,
  getLatestStableVersionAdheringToMinimumAgeGate,
  getStorybookRerunCommand,
  getStorybookRerunInstruction,
  parsePackageTimeMap,
  parsePositiveIntegerConfigValue,
  parseReleaseTime,
} from './util.ts';

type NpmDependency = {
  version: string;
  resolved?: string;
  overridden?: boolean;
  dependencies?: NpmDependencies;
};

type NpmDependencies = {
  [key: string]: NpmDependency;
};

export type NpmListOutput = {
  dependencies: NpmDependencies;
};

const NPM_CONFIG_WORKSPACE_ARGS = ['--workspaces=false', '--include-workspace-root'] as const;

const NPM_ERROR_REGEX = /npm (ERR!|error) (code|errno) (\w+)/i;

const NPM_ERROR_CODES = {
  E401: 'Authentication failed or is required.',
  E403: 'Access to the resource is forbidden.',
  E404: 'Requested resource not found.',
  EACCES: 'Permission issue.',
  EAI_FAIL: 'DNS lookup failed.',
  EBADENGINE: 'Engine compatibility check failed.',
  EBADPLATFORM: 'Platform not supported.',
  ECONNREFUSED: 'Connection refused.',
  ECONNRESET: 'Connection reset.',
  EEXIST: 'File or directory already exists.',
  EINVALIDTYPE: 'Invalid type encountered.',
  EISGIT: 'Git operation failed or conflicts with an existing file.',
  EJSONPARSE: 'Error parsing JSON data.',
  EMISSINGARG: 'Required argument missing.',
  ENEEDAUTH: 'Authentication needed.',
  ENOAUDIT: 'No audit available.',
  ENOENT: 'File or directory does not exist.',
  ENOGIT: 'Git not found or failed to run.',
  ENOLOCK: 'Lockfile missing.',
  ENOSPC: 'Insufficient disk space.',
  ENOTFOUND: 'Resource not found.',
  EOTP: 'One-time password required.',
  EPERM: 'Permission error.',
  EPUBLISHCONFLICT: 'Conflict during package publishing.',
  ERESOLVE: 'Dependency resolution error.',
  EROFS: 'File system is read-only.',
  ERR_SOCKET_TIMEOUT: 'Socket timed out.',
  ETARGET: 'Package target not found.',
  ETIMEDOUT: 'Operation timed out.',
  ETOOMANYARGS: 'Too many arguments provided.',
  EUNKNOWNTYPE: 'Unknown type encountered.',
};

export class NPMProxy extends JsPackageManager {
  readonly type = PackageManagerName.NPM;

  installArgs: string[] | undefined;

  getCommandName(): string {
    return 'npm';
  }

  getInstallCommand(deps: string[], dev: boolean): string {
    return `npm install ${dev ? '-D ' : ''}${deps.join(' ')}`;
  }

  getRunCommand(command: string): string {
    return `npm run ${command}`;
  }

  async getModulePackageJSON(packageName: string): Promise<PackageJson | null> {
    const wantedPath = join('node_modules', packageName, 'package.json');
    const packageJsonPath = find.up(wantedPath, {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });

    if (!packageJsonPath) {
      return null;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson;
  }

  getInstallArgs(): string[] {
    if (!this.installArgs) {
      this.installArgs = [];
    }
    return this.installArgs;
  }

  public getPackageCommand(args: string[]): string {
    return `npx ${args.join(' ')}`;
  }

  public runPackageCommand(
    options: Omit<ExecuteCommandOptions, 'command'> & { args: string[] }
  ): ResultPromise {
    return executeCommand({
      command: 'npx',
      ...options,
    });
  }

  public runInternalCommand(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'inherit' | 'pipe' | 'ignore'
  ) {
    return executeCommand({
      command: 'npm',
      args: [command, ...args],
      cwd: cwd ?? this.cwd,
      stdio,
    });
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    const exec = ({ packageDepth }: { packageDepth: number }) => {
      return executeCommand({
        command: 'npm',
        args: ['ls', '--json', `--depth=${packageDepth}`],
        env: {
          FORCE_COLOR: 'false',
        },
        cwd: this.instanceDir,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
    };

    try {
      const childProcess = await exec({ packageDepth: depth });
      const commandResult = typeof childProcess.stdout === 'string' ? childProcess.stdout : '';
      const parsedOutput = JSON.parse(commandResult);

      return this.mapDependencies(parsedOutput, pattern);
    } catch {
      // when --depth is higher than 0, npm can return a non-zero exit code
      // in case the user's project has peer dependency issues. So we try again with no depth
      try {
        const childProcess = await exec({ packageDepth: 0 });
        const commandResult = typeof childProcess.stdout === 'string' ? childProcess.stdout : '';
        const parsedOutput = JSON.parse(commandResult);

        return this.mapDependencies(parsedOutput, pattern);
      } catch (e) {
        logger.debug(`Error finding installations for ${pattern.join(', ')}: ${String(e)}`);
        return undefined;
      }
    }
  }

  protected getResolutions(
    packageJson: PackageJson,
    versions: Record<string, string>
  ): Record<string, any> {
    return {
      overrides: {
        ...packageJson.overrides,
        ...versions,
      },
    };
  }

  protected runInstall(options?: { force?: boolean }) {
    return executeCommand({
      command: 'npm',
      args: ['install', ...this.getInstallArgs(), ...(options?.force ? ['--force'] : [])],
      cwd: this.cwd,
      stdio: prompt.getPreferredStdio(),
    });
  }

  async installDependencies(options?: InstallDependenciesOptions) {
    try {
      await super.installDependencies(options);
    } catch (error) {
      const logs = getErrorLogs(error);

      if (
        logs.match(/npm\s+(ERR!|error)\s+code\s+ETARGET/i) &&
        logs.includes('with a date before')
      ) {
        const handledError = new MinimumReleaseAgeHandledError({
          packageManagerName: 'npm',
          minimumReleaseAgeConfigName: 'min-release-age',
          minimumReleaseAgeConfigDocs:
            'https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age',
          failedPackage: this.extractMinimumReleaseAgePackage(logs),
          cause: error,
        });

        logger.error(handledError.message);
        throw handledError;
      }

      throw error;
    }
  }

  async precheckStorybookPackageInstall({
    storybookVersion,
    installContext,
  }: {
    storybookVersion: string;
    nonInteractive: boolean;
    installContext: 'create' | 'upgrade';
  }): Promise<void> {
    const minimumReleaseAgeDays = await this.getMinimumReleaseAge();

    if (!minimumReleaseAgeDays) {
      return;
    }

    const timeMap = await this.getPackageTimeMap('storybook');
    if (!timeMap) {
      return;
    }

    const releaseTime = timeMap[storybookVersion];
    if (!releaseTime) {
      return;
    }

    const publishedAt = parseReleaseTime(releaseTime);
    if (!publishedAt) {
      return;
    }

    const ageDays = getAgeInMinutes(publishedAt, new Date()) / (24 * 60);
    if (ageDays >= minimumReleaseAgeDays) {
      return;
    }

    const compatibleVersion = getLatestStableVersionAdheringToMinimumAgeGate(
      timeMap,
      minimumReleaseAgeDays * 24 * 60
    );
    const error = new MinimumReleaseAgeHandledError({
      message: this.createMinimumReleaseAgeRerunMessage({
        currentVersion: storybookVersion,
        compatibleVersion,
        installContext,
      }),
    });

    logger.error(error.message);
    throw error;
  }

  public async getRegistryURL() {
    const process = executeCommand({
      command: 'npm',
      // "npm config" commands are not allowed in workspaces per default
      // https://github.com/npm/cli/issues/6099#issuecomment-1847584792
      args: ['config', 'get', 'registry', ...NPM_CONFIG_WORKSPACE_ARGS],
    });
    const result = await process;
    const url = (typeof result.stdout === 'string' ? result.stdout : '').trim();
    return url === 'undefined' ? undefined : url;
  }

  protected runAddDeps(dependencies: string[], installAsDevDependencies: boolean) {
    let args = [...dependencies];

    if (installAsDevDependencies) {
      args = ['-D', ...args];
    }

    return executeCommand({
      command: 'npm',
      args: ['install', ...args, ...this.getInstallArgs()],
      stdio: prompt.getPreferredStdio(),
      cwd: this.primaryPackageJson.operationDir,
    });
  }

  protected async runGetVersions<T extends boolean>(
    packageName: string,
    fetchAllVersions: T
  ): Promise<T extends true ? string[] : string> {
    const args = fetchAllVersions ? ['versions', '--json'] : ['version'];
    try {
      const process = executeCommand({
        command: 'npm',
        args: ['info', packageName, ...args],
      });
      const result = await process;
      const commandResult = typeof result.stdout === 'string' ? result.stdout : '';

      const parsedOutput = fetchAllVersions ? JSON.parse(commandResult) : commandResult.trim();

      if (parsedOutput.error?.summary) {
        // this will be handled in the catch block below
        throw parsedOutput.error.summary;
      }

      return parsedOutput;
    } catch (error) {
      throw new FindPackageVersionsError({
        error,
        packageManager: 'NPM',
        packageName,
      });
    }
  }

  /**
   * @param input The output of `npm ls --json`
   * @param pattern A list of package names to filter the result. * can be used as a placeholder
   */
  protected mapDependencies(input: NpmListOutput, pattern: string[]): InstallationMetadata {
    const acc: Record<string, PackageMetadata[]> = {};
    const existingVersions: Record<string, string[]> = {};
    const duplicatedDependencies: Record<string, string[]> = {};

    const recurse = ([name, packageInfo]: [string, NpmDependency]): void => {
      // transform pattern into regex where `*` is replaced with `.*`
      if (!name || !pattern.some((p) => new RegExp(`^${p.replace(/\*/g, '.*')}$`).test(name))) {
        return;
      }

      const value = {
        version: packageInfo.version,
        location: '',
      };

      if (!existingVersions[name]?.includes(value.version)) {
        if (acc[name]) {
          acc[name].push(value);
        } else {
          acc[name] = [value];
        }
        existingVersions[name] = sort([...(existingVersions[name] || []), value.version]);

        if (existingVersions[name].length > 1) {
          duplicatedDependencies[name] = existingVersions[name];
        }
      }

      if (packageInfo.dependencies) {
        Object.entries(packageInfo.dependencies).forEach(recurse);
      }
    };

    Object.entries(input.dependencies).forEach(recurse);

    return {
      dependencies: acc,
      duplicatedDependencies,
      infoCommand: 'npm ls --depth=1',
      dedupeCommand: 'npm dedupe',
    };
  }

  private async getMinimumReleaseAge(): Promise<number | null> {
    const result = await executeCommand({
      command: 'npm',
      args: ['config', 'get', 'min-release-age', ...NPM_CONFIG_WORKSPACE_ARGS],
      cwd: this.cwd,
      stdio: 'pipe',
    });

    return parsePositiveIntegerConfigValue(
      typeof result.stdout === 'string' ? result.stdout : undefined
    );
  }

  private async getPackageTimeMap(packageName: string): Promise<Record<string, string> | null> {
    const result = await executeCommand({
      command: 'npm',
      args: ['info', packageName, 'time', '--json'],
      cwd: this.cwd,
      stdio: 'pipe',
    });

    const normalizedValue = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!normalizedValue) {
      return null;
    }

    return parsePackageTimeMap(JSON.parse(normalizedValue));
  }

  private createMinimumReleaseAgeRerunMessage({
    currentVersion,
    compatibleVersion,
    installContext,
  }: {
    currentVersion: string;
    compatibleVersion: string | null;
    installContext: 'create' | 'upgrade';
  }) {
    const rerunCommand = getStorybookRerunCommand(installContext, compatibleVersion);
    const rerunInstruction = getStorybookRerunInstruction(installContext);

    return dedent`
      npm min-release-age blocked storybook@${currentVersion} from being installed.

      ${rerunInstruction}
      ${rerunCommand}

      Read more:
      - https://docs.npmjs.com/cli/v11/using-npm/config#min-release-age
    `;
  }

  private extractMinimumReleaseAgePackage(logs: string): string | null {
    const exactVersionMatch = logs.match(
      /No matching version found for\s+((?:@[^/\s]+\/)?[^@\s]+)@([^\s]+)\s+with a date before/i
    );

    if (exactVersionMatch) {
      const [, packageName, version] = exactVersionMatch;
      return `${packageName}@${version}`;
    }

    const scopedMatch = logs.match(/((?:@[^/\s]+\/)?[^@\s]+)@([^\s"']+)/);

    if (!scopedMatch) {
      return null;
    }

    const [, packageName, version] = scopedMatch;
    return `${packageName}@${version}`;
  }
}
