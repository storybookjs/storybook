import sort from 'semver/functions/sort';
import { platform } from 'os';
import dedent from 'ts-dedent';
import { findUpSync } from 'find-up';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { logger } from '@storybook/core/node-logger';
import { FindPackageVersionsError } from '@storybook/core/server-errors';

import { JsPackageManager } from './JsPackageManager';
import type { PackageJson } from './PackageJson';
import type { InstallationMetadata, PackageMetadata } from './types';
import { createLogStream } from '../utils/cli';

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

export class NPMProxy extends JsPackageManager {
  readonly type = 'npm';

  installArgs: string[] | undefined;

  async initPackageJson() {
    await this.executeCommand({ command: 'npm', args: ['init', '-y'] });
  }

  getRunStorybookCommand(): string {
    return 'npm run storybook';
  }

  getRunCommand(command: string): string {
    return `npm run ${command}`;
  }

  async getNpmVersion(): Promise<string> {
    return this.executeCommand({ command: 'npm', args: ['--version'] });
  }

  public async getPackageJSON(
    packageName: string,
    basePath = this.cwd
  ): Promise<PackageJson | null> {
    const packageJsonPath = await findUpSync(
      (dir) => {
        const possiblePath = path.join(dir, 'node_modules', packageName, 'package.json');
        return existsSync(possiblePath) ? possiblePath : undefined;
      },
      { cwd: basePath }
    );

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

  public runPackageCommandSync(
    command: string,
    args: string[],
    cwd?: string,
    stdio?: 'pipe' | 'inherit'
  ): string {
    return this.executeCommandSync({
      command: 'npm',
      args: ['exec', '--', command, ...args],
      cwd,
      stdio,
    });
  }

  public async runPackageCommand(command: string, args: string[], cwd?: string): Promise<string> {
    return this.executeCommand({
      command: 'npm',
      args: ['exec', '--', command, ...args],
      cwd,
    });
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    const exec = async ({ packageDepth }: { packageDepth: number }) => {
      const pipeToNull = platform() === 'win32' ? '2>NUL' : '2>/dev/null';
      return this.executeCommand({
        command: 'npm',
        args: ['ls', '--json', `--depth=${packageDepth}`, pipeToNull],
        env: {
          FORCE_COLOR: 'false',
        },
      });
    };

    try {
      const commandResult = await exec({ packageDepth: depth });
      const parsedOutput = JSON.parse(commandResult);

      return this.mapDependencies(parsedOutput, pattern);
    } catch (e) {
      // when --depth is higher than 0, npm can return a non-zero exit code
      // in case the user's project has peer dependency issues. So we try again with no depth
      try {
        const commandResult = await exec({ packageDepth: 0 });
        const parsedOutput = JSON.parse(commandResult);

        return this.mapDependencies(parsedOutput, pattern);
      } catch (err) {
        logger.warn(`An issue occurred while trying to find dependencies metadata using npm.`);
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

  protected async runInstall() {
    await this.executeCommand({
      command: 'npm',
      args: ['install', ...this.getInstallArgs()],
      stdio: 'inherit',
    });
  }

  public async getRegistryURL() {
    const res = await this.executeCommand({
      command: 'npm',
      // "npm config" commands are not allowed in workspaces per default
      // https://github.com/npm/cli/issues/6099#issuecomment-1847584792
      args: ['config', 'get', 'registry', '-ws=false', '-iwr'],
    });
    const url = res.trim();
    return url === 'undefined' ? undefined : url;
  }

  protected async runAddDeps(dependencies: string[], installAsDevDependencies: boolean) {
    const { logStream, readLogFile, moveLogFile, removeLogFile } = await createLogStream();
    let args = [...dependencies];

    if (installAsDevDependencies) {
      args = ['-D', ...args];
    }

    try {
      await this.executeCommand({
        command: 'npm',
        args: ['install', ...args, ...this.getInstallArgs()],
        stdio: process.env.CI ? 'inherit' : ['ignore', logStream, logStream],
      });
    } catch (err) {
      const stdout = await readLogFile();

      const errorMessage = this.parseErrorFromLogs(stdout);

      await moveLogFile();

      throw new Error(
        dedent`${errorMessage}
        
        Please check the logfile generated at ./storybook.log for troubleshooting and try again.`
      );
    }

    await removeLogFile();
  }

  protected async runRemoveDeps(dependencies: string[]) {
    const args = [...dependencies];

    await this.executeCommand({
      command: 'npm',
      args: ['uninstall', ...this.getInstallArgs(), ...args],
      stdio: 'inherit',
    });
  }

  protected async runGetVersions<T extends boolean>(
    packageName: string,
    fetchAllVersions: T
  ): Promise<T extends true ? string[] : string> {
    const args = [fetchAllVersions ? 'versions' : 'version', '--json'];
    try {
      const commandResult = await this.executeCommand({
        command: 'npm',
        args: ['info', packageName, ...args],
      });

      const parsedOutput = JSON.parse(commandResult);

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
   *
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
