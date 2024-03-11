import sort from 'semver/functions/sort';
import { platform } from 'os';
import dedent from 'ts-dedent';
import { sync as findUpSync } from 'find-up';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import semver from 'semver';
import { logger } from '@storybook/node-logger';
import { JsPackageManager } from './JsPackageManager';
import type { PackageJson } from './PackageJson';
import type { InstallationMetadata, PackageMetadata } from './types';
import { createLogStream } from '../utils';

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

  public async getPackageVersion(packageName: string, basePath = this.cwd): Promise<string | null> {
    const packageJson = await this.getPackageJSON(packageName, basePath);
    return packageJson ? semver.coerce(packageJson.version)?.version ?? null : null;
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

  public async findInstallations() {
    const exec = async ({ depth }: { depth: number }) => {
      const pipeToNull = platform() === 'win32' ? '2>NUL' : '2>/dev/null';
      return this.executeCommand({
        command: 'npm',
        args: ['ls', '--json', `--depth=${depth}`, pipeToNull],
        env: {
          FORCE_COLOR: 'false',
        },
      });
    };

    try {
      const commandResult = await exec({ depth: 99 });
      const parsedOutput = JSON.parse(commandResult);

      return this.mapDependencies(parsedOutput);
    } catch (e) {
      // when --depth is higher than 0, npm can return a non-zero exit code
      // in case the user's project has peer dependency issues. So we try again with no depth
      try {
        const commandResult = await exec({ depth: 0 });
        const parsedOutput = JSON.parse(commandResult);

        return this.mapDependencies(parsedOutput);
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

    const commandResult = await this.executeCommand({
      command: 'npm',
      args: ['info', packageName, ...args],
    });

    try {
      const parsedOutput = JSON.parse(commandResult);

      if (parsedOutput.error) {
        // FIXME: improve error handling
        throw new Error(parsedOutput.error.summary);
      } else {
        return parsedOutput;
      }
    } catch (e) {
      throw new Error(`Unable to find versions of ${packageName} using npm`);
    }
  }

  protected mapDependencies(input: NpmListOutput): InstallationMetadata {
    const acc: Record<string, PackageMetadata[]> = {};
    const existingVersions: Record<string, string[]> = {};
    const duplicatedDependencies: Record<string, string[]> = {};

    const recurse = ([name, packageInfo]: [string, NpmDependency]): void => {
      if (!name || !name.includes('storybook')) return;

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
