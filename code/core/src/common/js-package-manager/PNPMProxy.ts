import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { logger, prompt } from 'storybook/internal/node-logger';
import {
  FindPackageVersionsError,
  MinimumReleaseAgeHandledError,
} from 'storybook/internal/server-errors';

import * as find from 'empathic/find';
// eslint-disable-next-line depend/ban-dependencies
import type { ResultPromise } from 'execa';
import { coerce, gte, prerelease } from 'semver';
import { dedent } from 'ts-dedent';
import { Document, parseDocument } from 'yaml';

import type { ExecuteCommandOptions } from '../utils/command.ts';
import { executeCommand, executeCommandSync } from '../utils/command.ts';
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

/** `pnpm dlx --allow-build` support (docs: Added in v10.2.0). */
const PNPM_ALLOW_BUILD_DLX_MIN = '10.2.0';

/** `allowBuilds` in pnpm-workspace.yaml (docs: Added in v10.26.0). */
const PNPM_ALLOW_BUILDS_MIN = '10.26.0';

/** pnpm 11 dropped the legacy build lists, so `allowBuilds` no longer conflicts with them. */
const PNPM_LEGACY_BUILD_LISTS_REMOVED = '11.0.0';

/** Storybook dependencies with a build script that pnpm 10+ refuses to run until it is approved. */
const STORYBOOK_BUILD_SCRIPT_PACKAGES = ['esbuild'];

/** pnpm 10 build-script list settings that `allowBuilds` replaced in pnpm 11. */
const LEGACY_BUILD_SCRIPT_LISTS = [
  'onlyBuiltDependencies',
  'ignoredBuiltDependencies',
  'neverBuiltDependencies',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Whether a build-script matcher names `pkg`. A matcher is a bare package name, or a name pinned to
 * versions (`esbuild@0.25.0 || 0.25.1`) or to a git/tarball source (`foo@git+ssh://...`).
 */
const matchesPackage = (matcher: unknown, pkg: string): boolean =>
  typeof matcher === 'string' && (matcher === pkg || matcher.startsWith(`${pkg}@`));

/**
 * Whether the user already allowed or denied `pkg`'s build scripts in a block of pnpm settings
 * (`pnpm-workspace.yaml`, or the `pnpm` field of package.json): through `allowBuilds`, through the
 * pnpm 10 list settings it replaced, or by allowing every build. A pinned `allowBuilds` matcher
 * counts whatever its value, since adding a bare `esbuild: true` next to it would widen the user's
 * choice; the bare key only counts once it holds a boolean, so pnpm's own placeholder still gets
 * resolved. On pnpm 10, pass `anyNeverBuiltDependencies`: that version rewrites `allowBuilds` into
 * `onlyBuiltDependencies`, and any `neverBuiltDependencies` list conflicts with it.
 */
function hasBuildScriptDecision(
  settings: unknown,
  pkg: string,
  { anyNeverBuiltDependencies = false }: { anyNeverBuiltDependencies?: boolean } = {}
): boolean {
  if (!isRecord(settings)) {
    return false;
  }
  if (settings.dangerouslyAllowAllBuilds === true) {
    return true;
  }
  const { allowBuilds } = settings;
  if (
    isRecord(allowBuilds) &&
    Object.entries(allowBuilds).some(([matcher, value]) =>
      matcher === pkg ? typeof value === 'boolean' : matchesPackage(matcher, pkg)
    )
  ) {
    return true;
  }
  return LEGACY_BUILD_SCRIPT_LISTS.some((key) => {
    const list = settings[key];
    if (!Array.isArray(list)) {
      return false;
    }
    if (anyNeverBuiltDependencies && key === 'neverBuiltDependencies') {
      return true;
    }
    return list.some((matcher) => matchesPackage(matcher, pkg));
  });
}

// Same-directory rename so a crash cannot truncate the user's workspace file.
function writeFileAtomically(filePath: string, contents: string): void {
  const tempPath = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeFileSync(tempPath, contents, 'utf8');
    renameSync(tempPath, filePath);
  } catch (error) {
    try {
      unlinkSync(tempPath);
    } catch {
      // The temp file was never created, or rename already consumed it.
    }
    throw error;
  }
}

/**
 * The package matchers listed in the JSON file that pnpm 10's `onlyBuiltDependenciesFile` points
 * to, resolved against the directory of the workspace file. An unreadable or malformed file counts
 * as listing nothing.
 */
function readOnlyBuiltDependenciesFile(settings: unknown, workspaceDir: string): unknown[] {
  if (!isRecord(settings) || typeof settings.onlyBuiltDependenciesFile !== 'string') {
    return [];
  }
  try {
    const list = JSON.parse(
      readFileSync(resolve(workspaceDir, settings.onlyBuiltDependenciesFile), 'utf8')
    );
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export class PNPMProxy extends JsPackageManager {
  readonly type = PackageManagerName.PNPM;

  /** Cached `pnpm --version` output; `undefined` until read, `null` if lookup failed. */
  #pnpmVersion: string | null | undefined;

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
    return this.#readPnpmVersion() ?? '';
  }

  #readPnpmVersion(): string | null {
    if (this.#pnpmVersion !== undefined) {
      return this.#pnpmVersion;
    }

    try {
      logger.debug('Executing command: pnpm --version');
      const stdout = executeCommandSync({
        cwd: this.cwd,
        command: 'pnpm',
        args: ['--version'],
        stdio: 'pipe',
      });
      this.#pnpmVersion = stdout.trim();
    } catch {
      this.#pnpmVersion = null;
    }

    return this.#pnpmVersion;
  }

  #pnpmGte(minimum: string): boolean {
    const version = coerce(this.#readPnpmVersion());
    return version != null && gte(version, minimum);
  }

  /**
   * `pnpm add` at a workspace root needs `-w` (pnpm 8 and 9 reject it otherwise), but `pnpm install
   * -w` skips every other workspace project from pnpm 9 on.
   */
  getInstallArgs(command: 'install' | 'add'): string[] {
    return command === 'add' && this.detectWorkspaceRoot() ? ['-w'] : [];
  }

  getPackageCommand(args: string[]): string {
    return `pnpm exec ${args.join(' ')}`;
  }

  getRemoteRunCommand(args: string[]): string {
    const allowBuild = this.#pnpmGte(PNPM_ALLOW_BUILD_DLX_MIN) ? '--allow-build=esbuild ' : '';
    return `pnpm ${allowBuild}dlx ${args.join(' ')}`;
  }

  public runPackageCommand({
    args,
    useRemotePkg = false,
    ...options
  }: Omit<ExecuteCommandOptions, 'command'> & {
    args: string[];
    useRemotePkg?: boolean;
  }): ResultPromise {
    // On pnpm 11+, Storybook-owned `dlx` can hang on approve-builds for esbuild.
    // Pass `--allow-build` only here — not on `add`, which persists `allowBuilds`
    // into the user's project config.
    const pnpmArgs = useRemotePkg
      ? [
          ...(this.#pnpmGte(PNPM_ALLOW_BUILD_DLX_MIN) ? ['--allow-build=esbuild'] : []),
          'dlx',
          ...args,
        ]
      : ['exec', ...args];

    return executeCommand({
      command: 'pnpm',
      args: pnpmArgs,
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
      args: ['config', 'get', 'registry', '--workspaces=false', '--include-workspace-root'],
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

  public async getModulePackageJSON(packageName: string): Promise<PackageJson | null> {
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

  override async getDeclaredVersionSpecifier(packageName: string): Promise<string | null> {
    const specifier = await super.getDeclaredVersionSpecifier(packageName);
    if (specifier) {
      return specifier;
    }
    const catalogName = this.#getCatalogName(this.getAllDependencies()[packageName]);
    if (catalogName === null) {
      return null;
    }
    const workspace = this.#readWorkspaceYaml();
    if (!workspace) {
      return null;
    }
    const version = workspace.doc.getIn([
      ...this.#catalogKeyPath(workspace.doc, catalogName),
      packageName,
    ]);
    // Catalog pins are strings, but YAML parses a bare numeric range like `vitest: 4` as a number.
    // Accept those too rather than silently dropping the pin.
    return typeof version === 'string' || typeof version === 'number' ? String(version) : null;
  }

  override writeCatalogUpgrades(
    specifiers: string[],
    declared: Partial<Record<string, string>>
  ): string[] {
    const upgrades = specifiers.map((specifier) => {
      const at = specifier.indexOf('@', 1);
      const name = specifier.slice(0, at);
      return {
        specifier,
        name,
        version: specifier.slice(at + 1),
        catalog: this.#getCatalogName(declared[name]),
      };
    });
    const catalogued = upgrades.filter(({ catalog }) => catalog !== null);
    const workspace = catalogued.length > 0 ? this.#readWorkspaceYaml() : undefined;
    if (!workspace) {
      return specifiers;
    }
    for (const { name, version, catalog } of catalogued) {
      const keyPath = [...this.#catalogKeyPath(workspace.doc, catalog!), name];
      const current = String(workspace.doc.getIn(keyPath) ?? '');
      const modifier =
        /^[~^]/.test(version) || prerelease(version) ? '' : (current.match(/^[~^]/)?.[0] ?? '');
      workspace.doc.setIn(keyPath, `${modifier}${version}`);
    }
    writeFileSync(workspace.path, workspace.doc.toString(), 'utf8');
    return upgrades.filter(({ catalog }) => catalog === null).map(({ specifier }) => specifier);
  }

  override applyVersionToRelatedPackages(
    packages: string[],
    version: string,
    anchorPackage: string
  ): string[] {
    const catalogName = this.#getCatalogName(this.getAllDependencies()[anchorPackage]);
    // When the anchor (e.g. vitest) is declared through a catalog, mirror that: register the
    // packages in the same catalog and reference it from package.json. Copying the raw `catalog:`
    // specifier without registering would fail install, since no such catalog entry exists. If the
    // catalog cannot be updated, fall back to direct pins, which always install.
    if (
      catalogName !== null &&
      this.#registerCatalogEntries(packages, version, anchorPackage, catalogName)
    ) {
      return packages.map((pkg) => `${pkg}@catalog:${catalogName}`);
    }
    return super.applyVersionToRelatedPackages(packages, version, anchorPackage);
  }

  /**
   * If `specifier` is a pnpm catalog reference (`catalog:` / `catalog:<name>`), return the catalog
   * name (`''` for the default catalog); otherwise return null.
   */
  #getCatalogName(specifier: string | undefined): string | null {
    const match = specifier?.match(/^catalog:(.*)$/);
    return match ? match[1].trim() : null;
  }

  /** Looks for a `pnpm-workspace.yaml` all the way down to the project root. */
  protected findWorkspaceYamlPath(): string | undefined {
    return find.up('pnpm-workspace.yaml', {
      cwd: this.primaryPackageJson.operationDir,
      last: getProjectRoot(),
    });
  }

  /**
   * pnpm 10+ refuses to run dependency build scripts until the user approves them, and from pnpm 11
   * an unreviewed script fails a non-interactive install (`ERR_PNPM_IGNORED_BUILDS`). pnpm install
   * has no `--allow-builds` flag, so we need to pre-approve builds. The only way to do this is to
   * record the allowed builds in the `pnpm-workspace.yaml` like pnpm approve-builds does.
   */
  protected allowStorybookBuildScripts(): void {
    if (!this.#pnpmGte(PNPM_ALLOW_BUILDS_MIN)) {
      return;
    }

    // Find workspace file, create one if needed.
    const workspace = this.#readWorkspaceYaml({ createIfMissing: true });
    if (!workspace) {
      logger.warn(
        `Could not allow build scripts of ${STORYBOOK_BUILD_SCRIPT_PACKAGES.join(', ')}: pnpm-workspace.yaml is unreadable`
      );
      return;
    }

    const { path, doc } = workspace;
    let changed = false;

    try {
      // An `allowBuilds:` key left empty (e.g. after its last entry was removed) is a null, which
      // `setIn` cannot descend into; start a map there. Other non-map values are user errors pnpm
      // rejects too, so just let the update fail below.
      if (doc.getIn(['allowBuilds']) == null) {
        doc.setIn(['allowBuilds'], doc.createNode({}));
      }

      // Add dependencies that need a build approval, unless the user already decided on them in the
      // workspace file, in package.json's `pnpm` field, or in a trusted-dependencies file.
      const settings = doc.toJS();
      const decisions = [settings, this.primaryPackageJson.packageJson.pnpm];
      const trustedDependencies = readOnlyBuiltDependenciesFile(settings, dirname(path));
      const anyNeverBuiltDependencies = !this.#pnpmGte(PNPM_LEGACY_BUILD_LISTS_REMOVED);
      for (const pkg of STORYBOOK_BUILD_SCRIPT_PACKAGES) {
        const decided =
          decisions.some((candidate) =>
            hasBuildScriptDecision(candidate, pkg, { anyNeverBuiltDependencies })
          ) || trustedDependencies.some((matcher) => matchesPackage(matcher, pkg));
        if (!decided) {
          doc.setIn(['allowBuilds', pkg], true);
          changed = true;
        }
      }

      // Write file back only if changes were needed.
      if (changed) {
        writeFileAtomically(path, doc.toString());
      }
    } catch (e) {
      logger.warn(
        `Could not allow build scripts of ${STORYBOOK_BUILD_SCRIPT_PACKAGES.join(', ')} in ${path}: ${String(e)}`
      );
    }
  }

  /**
   * Locate and parse the `pnpm-workspace.yaml` that governs this project, walking up from the
   * package.json we operate on. Returns null when the file is malformed, or when it is missing
   * and `createIfMissing` is unset. If `createIfMissing` is set, an empty document is returned
   * with the location to which it can be written (next to `package.json`).
   */
  #readWorkspaceYaml(options?: {
    createIfMissing: boolean;
  }): { path: string; doc: Document } | null {
    const path = this.findWorkspaceYamlPath();
    if (!path) {
      return options?.createIfMissing
        ? {
            path: join(this.primaryPackageJson.operationDir, 'pnpm-workspace.yaml'),
            doc: new Document(),
          }
        : null;
    }
    try {
      const doc = parseDocument(readFileSync(path, 'utf8'));
      if (doc.errors.length > 0) {
        throw doc.errors[0];
      }
      return { path, doc };
    } catch (e) {
      logger.debug(`Could not read pnpm workspace file ${path}: ${String(e)}`);
      return null;
    }
  }

  /**
   * The key path within a parsed `pnpm-workspace.yaml` for a catalog. Named catalogs live under
   * `catalogs.<name>`. The default catalog (referenced as `catalog:` or `catalog:default`) may be
   * defined either as top-level `catalog` or as `catalogs.default` — defining both is a pnpm config
   * error, so follow whichever form the workspace already uses.
   */
  #catalogKeyPath(doc: Document, catalogName: string): string[] {
    if (catalogName && catalogName !== 'default') {
      return ['catalogs', catalogName];
    }
    return doc.hasIn(['catalogs', 'default']) ? ['catalogs', 'default'] : ['catalog'];
  }

  /**
   * Register `packages` in the same catalog as `anchorPackage`, editing `pnpm-workspace.yaml` via
   * the `yaml` document API so the user's comments and formatting are preserved. The pnpm CLI can't
   * do this: `pnpm config set` rejects scoped keys and `pnpm add --save-catalog` writes a resolved
   * direct version whenever the requested range doesn't match an existing entry. Entries the user
   * already pinned are never overridden. Returns whether the entries are now present, i.e. whether
   * `catalog:` references to them will resolve.
   */
  #registerCatalogEntries(
    packages: string[],
    version: string,
    anchorPackage: string,
    catalogName: string
  ): boolean {
    const workspace = this.#readWorkspaceYaml();
    if (!workspace) {
      logger.warn(
        `Could not read pnpm-workspace.yaml to register catalog entries for: ${packages.join(', ')}`
      );
      return false;
    }
    try {
      const keyPath = this.#catalogKeyPath(workspace.doc, catalogName);
      // Reuse the anchor's own catalog entry when present (e.g. `^3.2.0`) so the new entries match
      // the format the user chose, rather than an exact installed version.
      const anchorVersion = workspace.doc.getIn([...keyPath, anchorPackage]);
      const entryVersion =
        typeof anchorVersion === 'string' || typeof anchorVersion === 'number'
          ? String(anchorVersion)
          : version;
      let changed = false;

      for (const pkg of packages) {
        // Never override an entry the user already pinned themselves.
        if (workspace.doc.getIn([...keyPath, pkg]) === undefined) {
          workspace.doc.setIn([...keyPath, pkg], entryVersion);
          changed = true;
        }
      }

      if (changed) {
        writeFileSync(workspace.path, workspace.doc.toString(), 'utf8');
      }
      return true;
    } catch (e) {
      logger.warn(`Could not update pnpm catalog in ${workspace.path}: ${String(e)}`);
      return false;
    }
  }

  protected runInstall(options?: { force?: boolean }) {
    this.allowStorybookBuildScripts();
    return executeCommand({
      command: 'pnpm',
      args: ['install', ...this.getInstallArgs('install'), ...(options?.force ? ['--force'] : [])],
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

    const commandArgs = ['add', ...args, ...this.getInstallArgs('add')];

    this.allowStorybookBuildScripts();
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
      ['--json', packageName, 'time'],
      undefined,
      'pipe'
    );

    const normalizedValue = typeof result.stdout === 'string' ? result.stdout.trim() : '';
    if (!normalizedValue) {
      return null;
    }

    const timeMap = parsePackageTimeMap(JSON.parse(normalizedValue));
    return parseReleaseTime(timeMap?.[version]);
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
