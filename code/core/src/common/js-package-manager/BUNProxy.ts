import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { logger, prompt } from 'storybook/internal/node-logger';
import { FindPackageVersionsError } from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ExecaChildProcess } from 'execa';
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

const NPM_ERROR_REGEX = /npm ERR! code (\w+)/;
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

export class BUNProxy extends JsPackageManager {
  readonly type = PackageManagerName.BUN;

  installArgs: string[] | undefined;

  async initPackageJson() {
    return executeCommand({ command: 'bun', args: ['init'] });
  }

  getRunStorybookCommand(): string {
    return 'bun run storybook';
  }

  getRunCommand(command: string): string {
    return `bun run ${command}`;
  }

  getRemoteRunCommand(pkg: string, args: string[], specifier?: string): string {
    return `bunx ${pkg}${specifier ? `@${specifier}` : ''} ${args.join(' ')}`;
  }

  public async getModulePackageJSON(
    packageName: string,
    cwd = this.cwd
  ): Promise<PackageJson | null> {
    const wantedPath = join('node_modules', packageName, 'package.json');
    const packageJsonPath = find.up(wantedPath, { cwd, last: getProjectRoot() });

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

  public runPackageCommand(
    options: Omit<ExecuteCommandOptions, 'command'> & { args: string[] }
  ): ExecaChildProcess {
    // The following command is unsafe to use with `bun run`
    // because it will always favour a equally script named in the package.json instead of the installed binary.
    // so running `bun storybook automigrate` will run the
    // `storybook` script (dev) instead of the `storybook`. binary.
    // return executeCommand({
    //   command: 'bun',
    //   args: ['run', ...args],
    //   ...options,
    // });
    return executeCommand({
      command: 'bunx',
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
      command: 'bun',
      args: [command, ...args],
      cwd: cwd ?? this.cwd,
      stdio,
    });
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    const exec = async ({ packageDepth }: { packageDepth: number }) => {
      return executeCommand({
        command: 'npm',
        args: ['ls', '--json', `--depth=${packageDepth}`],
        cwd: this.cwd,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: {
          FORCE_COLOR: 'false',
        },
      });
    };

    try {
      const process = await exec({ packageDepth: depth });
      const result = await process;
      const commandResult = result.stdout ?? '';
      const parsedOutput = JSON.parse(commandResult);

      return this.mapDependencies(parsedOutput, pattern);
    } catch (e) {
      // when --depth is higher than 0, npm can return a non-zero exit code
      // in case the user's project has peer dependency issues. So we try again with no depth
      try {
        const process = await exec({ packageDepth: 0 });
        const result = await process;
        const commandResult = result.stdout ?? '';
        const parsedOutput = JSON.parse(commandResult);

        return this.mapDependencies(parsedOutput, pattern);
      } catch (err) {
        logger.debug(
          `An issue occurred while trying to find dependencies metadata using npm: ${err}`
        );
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
      command: 'bun',
      args: ['install', ...this.getInstallArgs(), ...(options?.force ? ['--force'] : [])],
      cwd: this.cwd,
      stdio: prompt.getPreferredStdio(),
    });
  }

  public async getRegistryURL() {
    const process = executeCommand({
      command: 'npm',
      cwd: this.cwd,
      // "npm config" commands are not allowed in workspaces per default
      // https://github.com/npm/cli/issues/6099#issuecomment-1847584792
      args: ['config', 'get', 'registry', '-ws=false', '-iwr'],
    });
    const result = await process;
    const url = (result.stdout ?? '').trim();
    return url === 'undefined' ? undefined : url;
  }

  protected runAddDeps(dependencies: string[], installAsDevDependencies: boolean) {
    let args = [...dependencies];

    if (installAsDevDependencies) {
      args = ['-D', ...args];
    }

    return executeCommand({
      command: 'bun',
      args: ['add', ...args, ...this.getInstallArgs()],
      stdio: 'pipe',
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
        cwd: this.cwd,
        args: ['info', packageName, ...args],
      });
      const result = await process;
      const commandResult = result.stdout ?? '';

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
      const errorCode = match[1] as keyof typeof NPM_ERROR_CODES;
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
