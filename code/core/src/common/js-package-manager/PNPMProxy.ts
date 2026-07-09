import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { logger, prompt } from 'storybook/internal/node-logger';
import {
  FindPackageVersionsError,
  MinimumReleaseAgeHandledError,
} from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ResultPromise } from 'execa';
import { dedent } from 'ts-dedent';
import { parseDocument } from 'yaml';

import type { ExecuteCommandOptions } from '../utils/command.ts';
import { executeCommand } from '../utils/command.ts';
import { getProjectRoot } from '../utils/paths.ts';
import { JsPackageManager, PackageManagerName } from './JsPackageManager.ts';
import type { PackageJson } from './PackageJson.ts';
import type { InstallationMetadata, PackageMetadata } from './types.ts';
import {
  getAgeInMinutes,
  getErrorLogs,
  getLatestStableVersionAdheringToMinimumAgeGate,
  getStorybookRerunCommand,
  getStorybookRerunInstruction,
  hasStorybookMinimumAgeExclusions,
  parsePackageTimeMap,
  parsePositiveIntegerConfigValue,
  parseReleaseTime,
  STORYBOOK_PACKAGE_PATTERNS,
} from './util.ts';

type PnpmDependency = {
  from: string;
  version: string;
  resolved: string;
  dependencies?: PnpmDependencies;
};

type PnpmDependencies = {
  [key: string]: PnpmDependency;
};

type PnpmListItem = {
  dependencies: PnpmDependencies;
  peerDependencies: PnpmDependencies;
  devDependencies: PnpmDependencies;
};

export type PnpmListOutput = PnpmListItem[];

const PNPM_ERROR_REGEX = /(ELIFECYCLE|ERR_PNPM_[A-Z_]+)\s+(.*)/i;

export class PNPMProxy extends JsPackageManager {
  readonly type = PackageManagerName.PNPM;

  installArgs: string[] | undefined;

  detectWorkspaceRoot() {
    const CWD = process.cwd();

    const pnpmWorkspaceYaml = `${CWD}/pnpm-workspace.yaml`;
    return existsSync(pnpmWorkspaceYaml);
  }

  getCommandName(): string {
    return 'pnpm';
  }

  getInstallCommand(deps: string[], dev: boolean): string {
    return `pnpm add ${dev ? '-D ' : ''}${deps.join(' ')}`;
  }

  getRunCommand(command: string): string {
    return `pnpm run ${command}`;
  }

  async getPnpmVersion(): Promise<string> {
    const result = await executeCommand({
      cwd: this.cwd,
      command: 'pnpm',
      args: ['--version'],
    });
    return typeof result.stdout === 'string' ? result.stdout : '';
  }

  getInstallArgs(): string[] {
    if (!this.installArgs) {
      this.installArgs = [];

      if (this.detectWorkspaceRoot()) {
        this.installArgs.push('-w');
      }
    }
    return this.installArgs;
  }

  getPackageCommand(args: string[]): string {
    return `pnpm exec ${args.join(' ')}`;
  }

  public runPackageCommand({
    args,
    useRemotePkg = false,
    ...options
  }: Omit<ExecuteCommandOptions, 'command'> & {
    args: string[];
    useRemotePkg?: boolean;
  }): ResultPromise {
    return executeCommand({
      command: 'pnpm',
      args: [useRemotePkg ? 'dlx' : 'exec', ...args],
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
      command: 'pnpm',
      args: [command, ...args],
      cwd: cwd ?? this.cwd,
      stdio,
    });
  }

  public async getRegistryURL() {
    // pnpm 10.7.1+ falls back to npm for certain config keys (including registry)
    // https://github.com/pnpm/pnpm/pull/9346
    // "npm config" commands are not allowed in workspaces per default
    // https://github.com/npm/cli/issues/6099#issuecomment-1847584792
    const childProcess = await executeCommand({
      command: 'npm',
      cwd: this.cwd,
      args: ['config', 'get', 'registry', '-ws=false', '-iwr'],
    });
    const url = (typeof childProcess.stdout === 'string' ? childProcess.stdout : '').trim();
    return url === 'undefined' ? undefined : url;
  }

  public async findInstallations(pattern: string[], { depth = 99 }: { depth?: number } = {}) {
    try {
      const args = ['list', pattern.map((p) => `"${p}"`).join(' '), '--json', `--depth=${depth}`];
      const childProcess = await executeCommand({
        command: 'pnpm',
        shell: true,
        args,
        env: {
          FORCE_COLOR: 'false',
        },
        cwd: this.instanceDir,
      });
      const commandResult = typeof childProcess.stdout === 'string' ? childProcess.stdout : '';

      const parsedOutput = JSON.parse(commandResult);
      return this.mapDependencies(parsedOutput, pattern);
    } catch (e) {
      logger.debug(`Error finding installations for ${pattern.join(', ')}: ${String(e)}`);
      return undefined;
    }
  }

  // TODO: Remove pnp compatibility code in SB11
  public async getModulePackageJSON(packageName: string): Promise<PackageJson | null> {
    const pnpapiPath = find.any(['.pnp.js', '.pnp.cjs'], {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });

    if (pnpapiPath) {
      try {
        const pnpApi = await import(pathToFileURL(pnpapiPath).href);

        const resolvedPath = pnpApi.resolveToUnqualified(packageName, this.cwd, {
          considerBuiltins: false,
        });

        const pkgLocator = pnpApi.findPackageLocator(resolvedPath);
        const pkg = pnpApi.getPackageInformation(pkgLocator);

        const packageJSON = JSON.parse(
          readFileSync(join(pkg.packageLocation, 'package.json'), 'utf-8')
        );

        return packageJSON;
      } catch (error: any) {
        if (error.code !== 'MODULE_NOT_FOUND') {
          console.error('Error while fetching package version in PNPM PnP mode:', error);
        }
        return null;
      }
    }

    const wantedPath = join('node_modules', packageName, 'package.json');
    const packageJsonPath = find.up(wantedPath, {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });

    if (!packageJsonPath) {
      return null;
    }

    return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  }

  protected getResolutions(packageJson: PackageJson, versions: Record<string, string>) {
    return {
      overrides: {
        ...packageJson.overrides,
        ...versions,
      },
    };
  }

  /**
   * Locate the `pnpm-workspace.yaml` that governs this project's catalogs, walking up from the
   * package.json we operate on. Catalogs are only valid inside a pnpm workspace, so a `catalog:`
   * specifier implies this file exists somewhere up the tree.
   */
  #findWorkspaceYaml(): string | undefined {
    return find.up('pnpm-workspace.yaml', {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });
  }

  /**
   * The key path within a parsed `pnpm-workspace.yaml` for a catalog. The default catalog (referenced
   * as `catalog:` or `catalog:default`) lives under the top-level `catalog` key; named catalogs live
   * under `catalogs.<name>`.
   */
  #catalogKeyPath(catalogName?: string): string[] {
    return !catalogName || catalogName === 'default' ? ['catalog'] : ['catalogs', catalogName];
  }

  override getCatalogVersion(packageName: string, catalogName?: string): string | null {
    const workspaceYamlPath = this.#findWorkspaceYaml();
    if (!workspaceYamlPath) {
      return null;
    }
    try {
      const doc = parseDocument(readFileSync(workspaceYamlPath, 'utf8'));
      const version = doc.getIn([...this.#catalogKeyPath(catalogName), packageName]);
      // Catalog pins are strings, but YAML parses a bare numeric range like `vitest: 4` as a number.
      // Accept those too rather than silently dropping the pin.
      return typeof version === 'string' || typeof version === 'number' ? String(version) : null;
    } catch (e) {
      logger.debug(`Could not read pnpm catalog from ${workspaceYamlPath}: ${String(e)}`);
      return null;
    }
  }

  override syncWorkspaceCatalog(entries: Record<string, string>, catalogName?: string): void {
    const workspaceYamlPath = this.#findWorkspaceYaml();
    if (!workspaceYamlPath) {
      logger.warn(
        `Could not find pnpm-workspace.yaml to register catalog entries for: ${Object.keys(entries).join(', ')}`
      );
      return;
    }

    try {
      // Edit the document (rather than re-serializing a parsed object) so existing formatting and
      // comments in the user's workspace file are preserved.
      const doc = parseDocument(readFileSync(workspaceYamlPath, 'utf8'));
      const keyPath = this.#catalogKeyPath(catalogName);
      let changed = false;

      for (const [packageName, version] of Object.entries(entries)) {
        // Never override an entry the user already pinned themselves.
        if (doc.getIn([...keyPath, packageName]) === undefined) {
          doc.setIn([...keyPath, packageName], version);
          changed = true;
        }
      }

      if (changed) {
        writeFileSync(workspaceYamlPath, doc.toString(), 'utf8');
      }
    } catch (e) {
      logger.warn(`Could not update pnpm catalog in ${workspaceYamlPath}: ${String(e)}`);
    }
  }

  protected runInstall(options?: { force?: boolean }) {
    return executeCommand({
      command: 'pnpm',
      args: ['install', ...this.getInstallArgs(), ...(options?.force ? ['--force'] : [])],
      stdio: prompt.getPreferredStdio(),
      cwd: this.cwd,
    });
  }

  async installDependencies(options?: { force?: boolean }) {
    try {
      await super.installDependencies(options);
    } catch (error) {
      const logs = getErrorLogs(error);

      if (logs.includes('ERR_PNPM_NO_MATURE_MATCHING_VERSION')) {
        const handledError = new MinimumReleaseAgeHandledError({
          packageManagerName: 'pnpm',
          minimumReleaseAgeConfigName: 'minimumReleaseAge',
          minimumReleaseAgeConfigDocs: 'https://pnpm.io/settings#minimumreleaseage',
          minimumReleaseAgeExclusionsConfigName: 'minimumReleaseAgeExclude',
          minimumReleaseAgeExclusionsConfigDocs:
            'https://pnpm.io/settings#minimumreleaseageexclude',
          failedPackage: this.extractFailedPackage(logs),
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
    const minimumReleaseAge = await this.getMinimumReleaseAge();

    if (!minimumReleaseAge) {
      return;
    }

    if (hasStorybookMinimumAgeExclusions(await this.getMinimumReleaseAgeExclude())) {
      return;
    }

    const publishedAt = await this.getPackageReleaseTime('storybook', storybookVersion);

    if (!publishedAt) {
      return;
    }

    const ageMinutes = getAgeInMinutes(publishedAt, new Date());
    if (ageMinutes >= minimumReleaseAge) {
      return;
    }

    const compatibleVersion = await this.getLatestStableVersionAdheringToMinimumReleaseAge(
      'storybook',
      minimumReleaseAge
    );

    if (nonInteractive) {
      await this.updateMinimumReleaseAgeExclude();
      logger.info(
        dedent`
          pnpm minimumReleaseAge would block storybook@${storybookVersion} from being installed because it was released within the configured minimumReleaseAge window, so Storybook updated minimumReleaseAgeExclude for this project automatically.

          Added patterns: storybook, @storybook/*, eslint-plugin-storybook, @chromatic-com/storybook

          Read more:
          - https://pnpm.io/settings#minimumreleaseage
          - https://pnpm.io/settings#minimumreleaseageexclude
        `
      );
      return;
    }

    logger.warn(
      `pnpm minimumReleaseAge will block storybook@${storybookVersion} from being installed because it was published within the configured minimum-release-age window.`
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
            label: 'Update pnpm config to exclude Storybook packages',
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
      await this.updateMinimumReleaseAgeExclude();
      return;
    }

    logger.error(rerunError.message);
    throw rerunError;
  }

  protected runAddDeps(dependencies: string[], installAsDevDependencies: boolean) {
    let args = [...dependencies];

    if (installAsDevDependencies) {
      args = ['-D', ...args];
    }

    const commandArgs = ['add', ...args, ...this.getInstallArgs()];

    return executeCommand({
      command: 'pnpm',
      args: commandArgs,
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
        command: 'pnpm',
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
        packageManager: 'PNPM',
        packageName,
      });
    }
  }

  protected mapDependencies(input: PnpmListOutput, pattern: string[]): InstallationMetadata {
    const acc: Record<string, PackageMetadata[]> = {};
    const existingVersions: Record<string, string[]> = {};
    const duplicatedDependencies: Record<string, string[]> = {};
    const items: PnpmDependencies = input.reduce((curr, item) => {
      const { devDependencies, dependencies, peerDependencies } = item;
      const allDependencies = { ...devDependencies, ...dependencies, ...peerDependencies };
      return Object.assign(curr, allDependencies);
    }, {} as PnpmDependencies);

    const recurse = ([name, packageInfo]: [string, PnpmDependency]): void => {
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
        existingVersions[name] = [...(existingVersions[name] || []), value.version];

        if (existingVersions[name].length > 1) {
          duplicatedDependencies[name] = existingVersions[name];
        }
      }

      if (packageInfo.dependencies) {
        Object.entries(packageInfo.dependencies).forEach(recurse);
      }
    };
    Object.entries(items).forEach(recurse);

    return {
      dependencies: acc,
      duplicatedDependencies,
      infoCommand: 'pnpm list --depth=1',
      dedupeCommand: 'pnpm dedupe',
    };
  }

  private extractFailedPackage(logs: string): string | null {
    const match = logs.match(
      /Version\s+([^\s]+)\s+\([^)]*\)\s+of\s+((?:@[^/\s]+\/)?[^\s]+)\s+does not meet the minimumReleaseAge constraint/
    );

    if (!match) {
      return null;
    }

    const [, version, packageName] = match;
    return `${packageName}@${version}`;
  }

  private async getMinimumReleaseAge(): Promise<number | null> {
    const result = await this.runInternalCommand(
      'config',
      ['get', 'minimumReleaseAge'],
      undefined,
      'pipe'
    );

    return parsePositiveIntegerConfigValue(
      typeof result.stdout === 'string' ? result.stdout : undefined
    );
  }

  private async getPackageReleaseTime(packageName: string, version: string): Promise<Date | null> {
    const result = await this.runInternalCommand(
      'view',
      ['--json', packageName, `time[${version}]`],
      undefined,
      'pipe'
    );

    const normalizedValue = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!normalizedValue) {
      return null;
    }

    return parseReleaseTime(JSON.parse(normalizedValue));
  }

  private async getLatestStableVersionAdheringToMinimumReleaseAge(
    packageName: string,
    minimumReleaseAgeMinutes: number,
    now = new Date()
  ): Promise<string | null> {
    const result = await this.runInternalCommand(
      'view',
      ['--json', packageName, 'time'],
      undefined,
      'pipe'
    );

    const normalizedValue = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!normalizedValue) {
      return null;
    }

    const timeMap = parsePackageTimeMap(JSON.parse(normalizedValue));
    if (!timeMap) {
      return null;
    }

    return getLatestStableVersionAdheringToMinimumAgeGate(timeMap, minimumReleaseAgeMinutes, now);
  }

  private createMinimumReleaseAgeRerunMessage({
    currentVersion,
    compatibleVersion,
    installContext,
  }: {
    currentVersion: string;
    compatibleVersion: string | null;
    installContext: 'create' | 'upgrade';
  }): string {
    const rerunCommand = getStorybookRerunCommand(installContext, compatibleVersion);
    const rerunInstruction = getStorybookRerunInstruction(installContext);

    return dedent`
      pnpm minimumReleaseAge blocked storybook@${currentVersion} from being installed.

      ${rerunInstruction}
      ${rerunCommand}

      Read more:
      - https://pnpm.io/settings#minimumreleaseage
    `;
  }

  private async updateMinimumReleaseAgeExclude(): Promise<void> {
    const currentMinimumReleaseAgeExclude = await this.getMinimumReleaseAgeExclude();
    const nextMinimumReleaseAgeExclude = Array.from(
      new Set([...currentMinimumReleaseAgeExclude, ...STORYBOOK_PACKAGE_PATTERNS])
    );

    await prompt.executeTaskWithSpinner(
      () =>
        this.runInternalCommand(
          'config',
          [
            'set',
            '--location=project',
            '--json',
            'minimumReleaseAgeExclude',
            JSON.stringify(nextMinimumReleaseAgeExclude),
          ],
          undefined,
          'pipe'
        ),
      {
        id: 'update-pnpm-minimum-release-age-exclude',
        intro: 'Updating pnpm minimumReleaseAgeExclude...',
        error: 'Failed to update pnpm minimumReleaseAgeExclude.',
        success: 'Updated pnpm minimumReleaseAgeExclude',
      }
    );
  }

  private async getMinimumReleaseAgeExclude(): Promise<string[]> {
    const result = await this.runInternalCommand(
      'config',
      ['get', 'minimumReleaseAgeExclude', '--json'],
      undefined,
      'pipe'
    );

    const normalizedValue = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!normalizedValue || normalizedValue === 'undefined' || normalizedValue === 'null') {
      return [];
    }

    const parsedValue = JSON.parse(normalizedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter(
          (value): value is string => typeof value === 'string' && value.length > 0
        )
      : [];
  }
}
