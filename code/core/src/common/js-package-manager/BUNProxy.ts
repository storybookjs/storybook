import { readFileSync, writeFileSync } from 'node:fs';
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
import { JsPackageManager, PackageManagerName } from './JsPackageManager.ts';
import type { PackageJson } from './PackageJson.ts';
import type { InstallationMetadata, PackageMetadata } from './types.ts';
import {
  getErrorLogs,
  getLatestStableVersionAdheringToMinimumAgeGate,
  getStorybookRerunCommand,
  getStorybookRerunInstruction,
  hasStorybookMinimumAgeExclusions,
  parsePackageTimeMap,
  parseReleaseTime,
  STORYBOOK_PACKAGE_PATTERNS,
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

  getCommandName(): string {
    return 'bun';
  }

  getInstallCommand(deps: string[], dev: boolean): string {
    return `bun add ${dev ? '-D ' : ''}${deps.join(' ')}`;
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

  getPackageCommand(args: string[]): string {
    return `bunx ${args.join(' ')}`;
  }

  public async getModulePackageJSON(packageName: string): Promise<PackageJson | null> {
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

  public runPackageCommand(
    options: Omit<ExecuteCommandOptions, 'command'> & { args: string[] }
  ): ResultPromise {
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
      const commandResult = typeof result.stdout === 'string' ? result.stdout : '';
      const parsedOutput = JSON.parse(commandResult);

      return this.mapDependencies(parsedOutput, pattern);
    } catch (e) {
      // when --depth is higher than 0, npm can return a non-zero exit code
      // in case the user's project has peer dependency issues. So we try again with no depth
      try {
        const process = await exec({ packageDepth: 0 });
        const result = await process;
        const commandResult = typeof result.stdout === 'string' ? result.stdout : '';
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
      command: 'bun',
      args: ['install', ...this.getInstallArgs(), ...(options?.force ? ['--force'] : [])],
      cwd: this.cwd,
      stdio: prompt.getPreferredStdio(),
    });
  }

  async installDependencies(options?: { force?: boolean }) {
    try {
      await super.installDependencies(options);
    } catch (error) {
      const logs = getErrorLogs(error);

      if (logs.includes('minimum-release-age') || logs.includes('minimum release age')) {
        const handledError = new MinimumReleaseAgeHandledError({
          packageManagerName: 'bun',
          minimumReleaseAgeConfigName: 'minimumReleaseAge',
          minimumReleaseAgeConfigDocs: 'https://bun.com/docs/pm/cli/install#minimum-release-age',
          minimumReleaseAgeExclusionsConfigName: 'minimumReleaseAgeExcludes',
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
    nonInteractive,
    installContext,
  }: {
    storybookVersion: string;
    nonInteractive: boolean;
    installContext: 'create' | 'upgrade';
  }): Promise<void> {
    const bunfig = this.readBunfig();
    const minimumReleaseAgeSeconds = this.getMinimumReleaseAgeSeconds(bunfig);

    if (!minimumReleaseAgeSeconds) {
      return;
    }

    if (hasStorybookMinimumAgeExclusions(this.getMinimumReleaseAgeExcludes(bunfig ?? ''))) {
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

    const ageSeconds = Math.floor((Date.now() - publishedAt.getTime()) / 1_000);
    if (ageSeconds >= minimumReleaseAgeSeconds) {
      return;
    }

    const compatibleVersion = getLatestStableVersionAdheringToMinimumAgeGate(
      timeMap,
      Math.ceil(minimumReleaseAgeSeconds / 60)
    );

    if (nonInteractive) {
      this.updateMinimumReleaseAgeExcludes();
      logger.info(
        dedent`
          bun minimumReleaseAge would block storybook@${storybookVersion} from being installed because it was released within the configured minimumReleaseAge window, so Storybook updated minimumReleaseAgeExcludes for this project automatically.

          Added patterns: storybook, @storybook/*, eslint-plugin-storybook, @chromatic-com/storybook

          Read more:
          - https://bun.com/docs/pm/cli/install#minimum-release-age
        `
      );
      return;
    }

    logger.warn(
      `bun minimumReleaseAge will block storybook@${storybookVersion} from being installed because it was released within the disallowed immaturity window.`
    );

    const rerunError = new MinimumReleaseAgeHandledError({
      message: this.createMinimumReleaseAgeRerunMessage({
        currentVersion: storybookVersion,
        compatibleVersion,
        installContext,
      }),
    });

    const selection = await prompt.select(
      {
        message: 'How would you like to proceed?',
        options: [
          {
            label: 'Update bunfig.toml to exclude Storybook packages from minimumReleaseAge',
            value: 'exclude',
          },
          {
            label: compatibleVersion
              ? `Stop now and rerun with the most recent allowed release: storybook@${compatibleVersion}`
              : 'Stop now and rerun with an older stable Storybook release later',
            value: 'rerun',
          },
        ],
      },
      {
        onCancel: () => {
          logger.error(rerunError.message);
          throw rerunError;
        },
      }
    );

    if (selection === 'exclude') {
      this.updateMinimumReleaseAgeExcludes();
      return;
    }

    logger.error(rerunError.message);
    throw rerunError;
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
    const url = (typeof result.stdout === 'string' ? result.stdout : '').trim();
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

  private getMinimumReleaseAgeSeconds(bunfig = this.readBunfig()): number | null {
    if (!bunfig) {
      return null;
    }

    const match = bunfig.match(/^minimumReleaseAge\s*=\s*(\d+)\s*$/m);
    if (!match) {
      return null;
    }

    const parsedValue = Number.parseInt(match[1], 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : null;
  }

  private async getPackageTimeMap(packageName: string): Promise<Record<string, string> | null> {
    const result = await executeCommand({
      command: 'npm',
      cwd: this.cwd,
      args: ['info', packageName, 'time', '--json'],
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
      bun minimumReleaseAge blocked storybook@${currentVersion} from being installed.

      ${rerunInstruction}
      ${rerunCommand}

      Read more:
      - https://bun.com/docs/pm/cli/install#minimum-release-age
    `;
  }

  private updateMinimumReleaseAgeExcludes() {
    const bunfigPath = join(this.cwd, 'bunfig.toml');
    const currentContent = this.readBunfig() ?? '';
    const lineEnding = currentContent.includes('\r\n') ? '\r\n' : '\n';
    const nextPatterns = Array.from(
      new Set([...this.getMinimumReleaseAgeExcludes(currentContent), ...STORYBOOK_PACKAGE_PATTERNS])
    );
    const replacement = [
      'minimumReleaseAgeExcludes = [',
      ...nextPatterns.map((pattern) => `  "${pattern}",`),
      ']',
    ].join(lineEnding);

    // `minimumReleaseAgeExcludes` belongs in Bun's `[install]` table. Restricting
    // the rewrite to that slice avoids accidentally appending the key into a later table.
    const installSectionRange = this.getTomlSectionRange(currentContent, 'install');
    const nextContent = installSectionRange
      ? [
          currentContent.slice(0, installSectionRange.start),
          this.updateMinimumReleaseAgeExcludesInContent(
            currentContent.slice(installSectionRange.start, installSectionRange.end),
            replacement,
            lineEnding
          ),
          currentContent.slice(installSectionRange.end),
        ].join('')
      : this.updateMinimumReleaseAgeExcludesInContent(currentContent, replacement, lineEnding);

    writeFileSync(bunfigPath, nextContent);
  }

  private updateMinimumReleaseAgeExcludesInContent(
    content: string,
    replacement: string,
    lineEnding: string
  ) {
    // Keep an existing list in place when it already exists. Otherwise, insert the
    // new property directly after `minimumReleaseAge` so related Bun settings stay together.
    if (content.match(/^minimumReleaseAgeExcludes\s*=\s*\[[\s\S]*?\]/m)) {
      return content.replace(/^minimumReleaseAgeExcludes\s*=\s*\[[\s\S]*?\]/m, replacement);
    }

    if (content.match(/^minimumReleaseAge\s*=\s*.+$/m)) {
      return content.replace(
        /^minimumReleaseAge\s*=\s*.+$/m,
        (minimumReleaseAgeLine) => `${minimumReleaseAgeLine}${lineEnding}${replacement}`
      );
    }

    return `${content}${content.trim().length > 0 ? `${lineEnding}${lineEnding}` : ''}${replacement}${lineEnding}`;
  }

  private getTomlSectionRange(content: string, sectionName: string) {
    const escapedSectionName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionHeader = new RegExp(`^\\[${escapedSectionName}\\]\\s*$`, 'm');
    const sectionMatch = sectionHeader.exec(content);

    if (!sectionMatch || sectionMatch.index === undefined) {
      return null;
    }

    const nextSectionHeader = /^\[[^\]]+\]\s*$/gm;
    nextSectionHeader.lastIndex = sectionMatch.index + sectionMatch[0].length;
    const nextSectionMatch = nextSectionHeader.exec(content);

    return {
      start: sectionMatch.index,
      end: nextSectionMatch?.index ?? content.length,
    };
  }

  private getMinimumReleaseAgeExcludes(bunfig: string): string[] {
    const match = bunfig.match(/^minimumReleaseAgeExcludes\s*=\s*\[([\s\S]*?)\]/m);
    if (!match) {
      return [];
    }

    return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
  }

  private readBunfig(): string | null {
    try {
      return readFileSync(join(this.cwd, 'bunfig.toml'), 'utf-8');
    } catch {
      return null;
    }
  }

  private extractMinimumReleaseAgePackage(logs: string): string | null {
    const exactVersionMatch = logs.match(
      /Version\s+"((?:@[^/\s"]+\/)?[^@\s"]+@[^\s"]+)"\s+was published within minimum release age/
    );

    if (exactVersionMatch) {
      return exactVersionMatch[1];
    }

    const rangedSpecifierMatch = logs.match(
      /No version matching\s+"((?:@[^/\s"]+\/)?[^\s"]+)"\s+found for specifier\s+"([^"]+)"\s+\(blocked by minimum-release-age:/
    );

    if (rangedSpecifierMatch) {
      const [, packageName, specifier] = rangedSpecifierMatch;
      return `${packageName}@${specifier}`;
    }

    const failedToResolveMatch = logs.match(
      /error:\s+((?:@[^/\s]+\/)?[^@\s]+@[^\s]+)\s+failed to resolve/
    );

    if (failedToResolveMatch) {
      return failedToResolveMatch[1];
    }

    const match = logs.match(/((?:@[^/\s]+\/)?[^@\s]+)@([^\s"']+)/);

    if (!match) {
      return null;
    }

    const [, packageName, version] = match;
    return `${packageName}@${version}`;
  }
}
