import { readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { logger, prompt } from 'storybook/internal/node-logger';
import {
  FindPackageVersionsError,
  MinimumReleaseAgeHandledError,
} from 'storybook/internal/server-errors';

import detectIndent from 'detect-indent';
// eslint-disable-next-line depend/ban-dependencies
import type { ResultPromise } from 'execa';
import { join } from 'pathe';
import { satisfies } from 'semver';
import { dedent } from 'ts-dedent';

import { isCorePackage } from '../utils/cli.ts';
import type { ExecuteCommandOptions } from '../utils/command.ts';
import { executeCommand } from '../utils/command.ts';
import { JsPackageManager, PackageManagerName } from './JsPackageManager.ts';
import type { PackageJson } from './PackageJson.ts';
import { NPM_LOCKFILE } from './constants.ts';
import type { InstallationMetadata } from './types.ts';
import {
  findInstallationsInDependencyTree,
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

const LOCKED_PACKAGE_NAME = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/;

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

  getInstallArgs(): string[] {
    if (!this.installArgs) {
      this.installArgs = [];
    }
    return this.installArgs;
  }

  public getPackageCommand(args: string[]): string {
    return `npx ${args.join(' ')}`;
  }

  public getRemoteRunCommand(args: string[]): string {
    return `npx ${args.join(' ')}`;
  }

  public runPackageCommand({
    useRemotePkg = false,
    ...options
  }: Omit<ExecuteCommandOptions, 'command'> & {
    args: string[];
    useRemotePkg?: boolean;
  }): ResultPromise {
    return executeCommand({
      command: 'npx',
      ...options,
      ...(useRemotePkg && { env: { npm_config_yes: 'true', ...options.env } }),
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

  #installDirectory() {
    const packageJsonPath = this.packageJsonPaths[0];
    const workspacePackageJsonPath =
      packageJsonPath && this.findWorkspaceRootPackageJsonPath(packageJsonPath);

    return workspacePackageJsonPath ? dirname(workspacePackageJsonPath) : this.cwd;
  }

  protected runInstall(options?: { force?: boolean }) {
    return executeCommand({
      command: 'npm',
      args: ['install', ...this.getInstallArgs(), ...(options?.force ? ['--force'] : [])],
      cwd: this.#installDirectory(),
      stdio: prompt.getPreferredStdio(),
    });
  }

  // npm refuses to replace a locked Storybook package that its old siblings still peer on, although
  // the same install replaces those siblings too: https://github.com/npm/cli/issues/8059
  unlockStorybookPackages({ from, to }: { from: string; to: string }) {
    const requiresOldVersion = (range: string) => satisfies(from, range) && !satisfies(to, range);
    const oldPeerRange = `^${from}`;
    if (!requiresOldVersion(oldPeerRange)) {
      return;
    }

    const installDirectory = this.#installDirectory();
    const lockfilePath = join(installDirectory, NPM_LOCKFILE);
    try {
      const content = readFileSync(lockfilePath, 'utf8');
      const lockfile: { packages?: Record<string, { version?: string }> } = JSON.parse(content);
      const packages = lockfile.packages ?? {};
      const locations = Object.keys(packages);

      const replaced = locations.filter(
        (location) =>
          isCorePackage(LOCKED_PACKAGE_NAME.exec(location)?.[1] ?? '') &&
          packages[location].version === from
      );
      const workspaces = locations.filter((location) => !location.includes('node_modules/'));
      const isOldVersionStillRequired = () =>
        workspaces.some((workspace) => {
          const manifest: PackageJson = JSON.parse(
            readFileSync(join(installDirectory, workspace, 'package.json'), 'utf8')
          );
          return [manifest.dependencies, manifest.devDependencies, manifest.peerDependencies].some(
            (dependencies) =>
              Object.entries(dependencies ?? {}).some(
                ([name, range]) => isCorePackage(name) && !!range && requiresOldVersion(range)
              )
          );
        });
      if (replaced.length === 0 || isOldVersionStillRequired()) {
        return;
      }

      for (const location of locations) {
        if (replaced.some((parent) => location === parent || location.startsWith(`${parent}/`))) {
          delete packages[location];
        }
      }
      const serialized = `${JSON.stringify(lockfile, null, detectIndent(content).indent || 2)}\n`;
      writeFileSync(
        lockfilePath,
        content.includes('\r\n') ? serialized.replaceAll('\n', '\r\n') : serialized
      );
    } catch (error) {
      logger.debug(`Left ${lockfilePath} as it is: ${error}`);
    }
  }

  async installDependencies(options?: { force?: boolean }) {
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

  protected async runGetPeerDependencies(
    packageSpec: string
  ): Promise<Record<string, string> | undefined> {
    const result = await executeCommand({
      command: 'npm',
      args: ['info', packageSpec, 'peerDependencies', '--json'],
      cwd: this.cwd,
      stdio: 'pipe',
    });
    // npm prints nothing when the version has no peer dependencies.
    const output = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    return output ? JSON.parse(output) : undefined;
  }

  /**
   * @param input The output of `npm ls --json`
   * @param pattern A list of package names to filter the result. * can be used as a placeholder
   */
  protected mapDependencies(input: NpmListOutput, pattern: string[]): InstallationMetadata {
    return {
      ...findInstallationsInDependencyTree(input.dependencies, pattern),
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
