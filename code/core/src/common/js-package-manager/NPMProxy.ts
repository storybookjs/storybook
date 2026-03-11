import { readFileSync } from 'node:fs';
import { platform } from 'node:os';
import { join } from 'node:path';

import { logger, prompt } from 'storybook/internal/node-logger';
import { FindPackageVersionsError } from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ResultPromise } from 'execa';
import sort from 'semver/functions/sort.js';

import type { ExecuteCommandOptions } from '../utils/command';
import { executeCommand } from '../utils/command';
import { getProjectRoot } from '../utils/paths';
import { JsPackageManager, PackageManagerName } from './JsPackageManager';
import type { PackageJson } from './PackageJson';
import type { InstallationMetadata, PackageMetadata } from './types';

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
      const pipeToNull = platform() === 'win32' ? '2>NUL' : '2>/dev/null';
      return executeCommand({
        command: 'npm',
        args: ['ls', '--json', `--depth=${packageDepth}`, pipeToNull],
        env: {
          FORCE_COLOR: 'false',
        },
        cwd: this.instanceDir,
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

  protected getResolutions(packageJson: PackageJson, versions: Record<string, string>) {
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

  public async getRegistryURL() {
    const process = executeCommand({
      command: 'npm',
      // "npm config" commands are not allowed in workspaces per default
      // https://github.com/npm/cli/issues/6099#issuecomment-1847584792
      args: ['config', 'get', 'registry', '-ws=false', '-iwr'],
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

  public parseErrorFromLogs(logs: string): string {
    let finalMessage = 'NPM error';
    const match = logs.match(NPM_ERROR_REGEX);

    if (match) {
      const errorCode = match[3] as keyof typeof NPM_ERROR_CODES;
      if (errorCode) {
        finalMessage = `${finalMessage} ${errorCode}`;
      }

      const errorMessage = NPM_ERROR_CODES[errorCode];
      if (errorMessage) {
        finalMessage = `${finalMessage} - ${errorMessage}`;
      }
    }

    return finalMessage.trim();
  }
}
