import type { PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';
import {
  HandledError,
  JsPackageManager,
  LOCK_FILES,
  getPkgPrNewPackageSpecifier,
  getProjectRoot,
  getStorybookConfiguration,
  isPkgPrNewVersionSpecifier,
  isSatelliteAddon,
  supportedExtensions,
  versions,
} from 'storybook/internal/common';
import {
  experimental_loadStorybook,
  getStoriesPathsFromConfig,
} from 'storybook/internal/core-server';
import { logTracker, logger, prompt } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookConfigDirNotFoundError,
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { readFile, realpath } from 'node:fs/promises';

import * as find from 'empathic/find';
import * as walk from 'empathic/walk';
import { normalize } from 'pathe';
// eslint-disable-next-line depend/ban-dependencies
import { globby, globbySync, isGitIgnored } from 'globby';
import { dirname, isAbsolute, relative, resolve } from 'pathe';
import picocolors from 'picocolors';
import { lt, major, minVersion, prerelease, rsort, satisfies, validRange } from 'semver';

import { autoblock } from './autoblock/index.ts';
import type { AutoblockerResult } from './autoblock/types.ts';
import { getStorybookData } from './automigrate/helpers/mainConfigFile.ts';
import { type UpgradeOptions } from './upgrade.ts';

export { getStoriesPathsFromConfig };

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Configuration for upgrading Storybook dependencies */
type DependencyType = 'dependencies' | 'devDependencies' | 'peerDependencies';

interface UpgradeConfig {
  readonly packageManager: JsPackageManager;
  readonly isCanary: boolean;
  readonly isCLIOutdated: boolean;
  readonly isCLIPrerelease: boolean;
  readonly isCLIExactPrerelease: boolean;
  readonly isCLIExactLatest: boolean;
  readonly storybookVersionSpecifier?: string;
}

/** Result of successfully collecting project data */
export interface CollectProjectsSuccessResult extends UpgradeConfig {
  configDir: string;
  readonly mainConfig: StorybookConfigRaw;
  readonly mainConfigPath: string | undefined;
  readonly previewConfigPath: string | undefined;
  readonly isUpgrade: boolean;
  readonly beforeVersion: string;
  readonly currentCLIVersion: string;
  readonly latestCLIVersionOnNPM: string | null;
  readonly autoblockerCheckResults: AutoblockerResult<unknown>[] | null;
  readonly storiesPaths: string[];
}

/** Result when project collection fails */
interface CollectProjectsErrorResult {
  /** Path to the configuration directory that failed */
  readonly configDir: string;
  /** Error that occurred during collection */
  readonly error: Error;
}

/** Union type representing either success or error result from project collection */
export type CollectProjectsResult = CollectProjectsSuccessResult | CollectProjectsErrorResult;

/** Version modifier configuration */
interface VersionModifier {
  /** The modifier character(s) (^, ~, >=, etc.) */
  readonly modifier: string;
  /** Whether to use a fixed version (no modifier) */
  readonly useFixed: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Glob pattern for finding Storybook directories */
const STORYBOOK_DIR_PATTERN = ['**/.storybook', '**/.rnstorybook'];

const PACKAGE_JSON_PATTERN = '**/package.json';

const STORYBOOK_BINS = ['storybook', 'sb', 'test-storybook'];

/** Words before a command that run it in another directory, so its relative paths can't be resolved. */
const CWD_CHANGING_ARGS =
  /^(?:-C|-F|-w|--cwd|--prefix|--dir|--filter|--workspace|workspace)(?:=.*)?$/;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Type guard to check if a result is a success result
 *
 * @param result - The result to check
 * @returns True if the result is a success result
 */
export const isSuccessResult = (
  result: CollectProjectsResult
): result is CollectProjectsSuccessResult => !('error' in result);

/**
 * Type guard to check if a result is an error result
 *
 * @param result - The result to check
 * @returns True if the result is an error result
 */
export const isErrorResult = (
  result: CollectProjectsResult
): result is CollectProjectsErrorResult => 'error' in result;

/**
 * Extracts version modifier from a version specifier string
 *
 * @example
 *
 * ```typescript
 * const modifier = getVersionModifier('^1.0.0');
 * // Returns: { modifier: '^', useFixed: false }
 * ```
 *
 * @param versionSpecifier - Version string like "^1.0.0" or "~2.1.0"
 * @returns Version modifier configuration
 */
const getVersionModifier = (versionSpecifier: string): VersionModifier => {
  if (!versionSpecifier || typeof versionSpecifier !== 'string') {
    return { modifier: '', useFixed: true };
  }

  // Split in case of complex version strings like "9.0.0 || >= 0.0.0-pr.0"
  const firstPart = versionSpecifier.split(/\s*\|\|\s*/)[0]?.trim();
  if (!firstPart) {
    return { modifier: '', useFixed: true };
  }

  // Match common modifiers
  const match = firstPart.match(/^([~^><=]+)/);
  const modifier = match?.[1] ?? '';

  return {
    modifier,
    useFixed: !modifier,
  };
};

/**
 * Checks if a version represents a canary release
 *
 * @param version - Version string to check
 * @returns True if the version is a canary release
 */
export const isCanaryVersion = (version: string): boolean =>
  version.startsWith('0.0.0') ||
  version.startsWith('portal:') ||
  version.startsWith('workspace:') ||
  isPkgPrNewVersionSpecifier(version);

/**
 * Validates that a version string is not empty or undefined
 *
 * @param version - Version string to validate
 * @throws {UpgradeStorybookUnknownCurrentVersionError} When version is invalid
 */
function validateVersion(version: string | undefined): asserts version is string {
  if (!version) {
    throw new UpgradeStorybookUnknownCurrentVersionError();
  }
}

/**
 * Validates upgrade compatibility between versions
 *
 * @param currentVersion - Current CLI version
 * @param beforeVersion - Version before upgrade
 * @param isCanary - Whether this is a canary version
 * @throws {UpgradeStorybookToLowerVersionError} When trying to downgrade
 */
const validateUpgradeCompatibility = (
  currentVersion: string,
  beforeVersion: string,
  isCanary: boolean
): void => {
  if (!isCanary && lt(currentVersion, beforeVersion)) {
    throw new UpgradeStorybookToLowerVersionError({
      beforeVersion,
      currentVersion: currentVersion,
    });
  }
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Finds all Storybook projects in the specified directory
 *
 * @example
 *
 * ```typescript
 * const projects = await findStorybookProjects('/path/to/workspace');
 * console.log(projects); // ['/path/to/workspace/app1/.storybook', ...]
 * ```
 *
 * @param cwd - Current working directory to search from
 * @returns Promise resolving to array of Storybook project paths
 */
export const findStorybookProjects = async (cwd: string = process.cwd()): Promise<string[]> => {
  try {
    logger.debug(`Finding Storybook projects...`);
    // One walk finds both the .storybook directories and the package.json files whose scripts can
    // name config directories with other names.
    const entries = await globby([...STORYBOOK_DIR_PATTERN, PACKAGE_JSON_PATTERN], {
      cwd,
      dot: true,
      gitignore: true,
      // Packages like @nx/storybook ship .storybook templates, and globby misses .gitignore patterns
      // like `**/**/node_modules/`, so never rely on .gitignore to skip them.
      ignore: ['**/node_modules/**'],
      absolute: true,
      onlyFiles: false,
      objectMode: true,
      followSymbolicLinks: false,
    });

    const storybookDirs = entries
      .filter((entry) => entry.dirent.isDirectory() && entry.name !== 'package.json')
      .map((entry) => entry.path);
    const packageJsonPaths = entries
      .filter((entry) => entry.dirent.isFile() && entry.name === 'package.json')
      .map((entry) => entry.path);

    const scriptConfigDirs = await findConfigDirsInScripts(packageJsonPaths, cwd);
    const projects = await dedupeByRealpath([...storybookDirs, ...scriptConfigDirs]);

    logger.debug(`Found ${projects.length} Storybook projects`);

    return projects;
  } catch (error) {
    logger.error('Failed to find Storybook projects');
    throw error;
  }
};

/** Keeps the first spelling of each directory, so `.Storybook` or a symlink doesn't add a project. */
const dedupeByRealpath = async (paths: string[]): Promise<string[]> => {
  const realpaths = await Promise.all(paths.map((path) => realpath(path).catch(() => path)));
  const seen = new Set<string>();
  return paths.filter((_, index) => {
    const key = realpaths[index];
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Splits a package.json script into commands, and each command into words without their quotes.
 * Good enough to read flags; not a shell.
 */
const splitScript = (script: string): string[][] => {
  const commands: string[][] = [];
  let words: string[] = [];
  let word: string | undefined;
  let quote: string | undefined;

  const endWord = () => {
    if (word !== undefined) {
      words.push(word);
    }
    word = undefined;
  };
  const endCommand = () => {
    endWord();
    if (words.length > 0) {
      commands.push(words);
    }
    words = [];
  };

  for (const char of script) {
    if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        word += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      word ??= '';
    } else if (/\s/.test(char)) {
      endWord();
    } else if (char === ';' || char === '&' || char === '|') {
      endCommand();
    } else {
      word = (word ?? '') + char;
    }
  }
  endCommand();

  return commands;
};

const isStorybookBin = (word: string) => {
  const [name, version] = word.split(/(?<=.)@/);
  if (version !== undefined) {
    return STORYBOOK_BINS.includes(name);
  }
  if (!/[\\/]/.test(word)) {
    return STORYBOOK_BINS.includes(word);
  }
  // Only paths into node_modules, so a value like `./sb` isn't taken for the binary
  const segments = word.split(/[\\/]/);
  const binName = segments.at(-1)!.replace(/\.(cmd|cjs|mjs|js)$/, '');
  return (
    segments.includes('node_modules') &&
    (STORYBOOK_BINS.includes(binName) || segments.at(-3) === 'storybook')
  );
};

/** The value of the last `-c` / `--config-dir` in `args`, in any of the forms commander accepts. */
const getConfigDirArg = (args: string[]): string | undefined => {
  let configDir: string | undefined;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '-c' || arg === '--config-dir') {
      configDir = args[index + 1] ?? configDir;
      index++;
    } else if (arg.startsWith('--config-dir=')) {
      configDir = arg.slice('--config-dir='.length);
    } else if (/^-c[^-]/.test(arg)) {
      configDir = arg.slice(2).replace(/^=/, '');
    }
  }
  return configDir || undefined;
};

/**
 * Returns the config directories that a package.json's scripts pass to `storybook` with `-c` or
 * `--config-dir`, as written in the scripts. Commands that run in another directory (`cd`,
 * `--cwd`, `yarn workspace`, `--filter`, ...) are skipped, since their paths can't be resolved
 * against the package.json.
 *
 * @example
 *
 * ```typescript
 * getConfigDirsFromScripts({ 'storybook:dev': 'storybook dev -c ./storybook -p 6006' });
 * // Returns: ['./storybook']
 * ```
 */
export const getConfigDirsFromScripts = (scripts: Record<string, unknown> = {}): string[] => {
  const fromScript = (script: string): string[] => {
    const configDirs: string[] = [];
    for (const words of splitScript(script)) {
      if (words[0] === 'cd' || words[0] === 'pushd') {
        // Every later command runs elsewhere
        break;
      }
      // Quoted commands, as in `concurrently "storybook dev -c ./sb" "tsc -w"`
      configDirs.push(...words.filter((word) => /\s/.test(word)).flatMap(fromScript));

      const binIndex = words.findIndex(
        (word, index) => isStorybookBin(word) && !['run', 'run-script'].includes(words[index - 1])
      );
      if (
        binIndex === -1 ||
        words.slice(0, binIndex).some((word) => CWD_CHANGING_ARGS.test(word))
      ) {
        continue;
      }
      const configDir = getConfigDirArg(words.slice(binIndex + 1));
      if (configDir) {
        configDirs.push(configDir);
      }
    }
    return configDirs;
  };

  return Object.values(scripts).flatMap((script) =>
    typeof script === 'string' ? fromScript(script) : []
  );
};

const hasMainConfig = async (configDir: string) => {
  try {
    const mainConfigs = await globby(`main{${supportedExtensions.join(',')}}`, { cwd: configDir });
    return mainConfigs.length > 0;
  } catch {
    // The directory doesn't exist, as with `-c $CONFIG_DIR`
    return false;
  }
};

/**
 * Finds the config directories, with a main config, that the given package.json scripts name.
 * Applies the filters of the .storybook glob: inside `cwd`, outside node_modules, not gitignored.
 */
const findConfigDirsInScripts = async (
  packageJsonPaths: string[],
  cwd: string
): Promise<string[]> => {
  const isIgnored = await isGitIgnored({ cwd });
  const isSearchable = (configDir: string) => {
    const path = relative(cwd, configDir);
    return (
      !path.startsWith('..') &&
      !isAbsolute(path) &&
      !path.split('/').includes('node_modules') &&
      (path === '' || !isIgnored(configDir))
    );
  };

  const configDirs = await Promise.all(
    packageJsonPaths.map(async (packageJsonPath) => {
      try {
        const { scripts } = JSON.parse(await readFile(packageJsonPath, 'utf8'));
        const candidates = [
          ...new Set(
            getConfigDirsFromScripts(scripts).map((configDir) =>
              resolve(dirname(packageJsonPath), configDir)
            )
          ),
        ].filter(isSearchable);
        const found = await Promise.all(
          candidates.map(async (configDir) => ((await hasMainConfig(configDir)) ? configDir : null))
        );
        return found.filter((configDir): configDir is string => configDir !== null);
      } catch (error) {
        logger.debug(`Could not read the scripts of ${packageJsonPath}: ${String(error)}`);
        return [];
      }
    })
  );
  return configDirs.flat();
};

/** A package.json that still declares Storybook packages on an older major than the CLI. */
export interface OutdatedStorybookPackageJson {
  readonly packageJsonPath: string;
  /** The outdated dependencies, as `name range` */
  readonly dependencies: string[];
}

/** The directory of the closest lockfile at or above `dir`, else the project root. */
const getInstallRoot = (dir: string) => {
  const lockfilePath = find.any(LOCK_FILES, { cwd: dir, last: getProjectRoot() });
  return lockfilePath ? dirname(lockfilePath) : getProjectRoot();
};

/**
 * Where to look for outdated package.json files after upgrading `selectedProjects`: the installs
 * they belong to, minus the package.json files of projects the user left out on purpose.
 */
export const getOutdatedScanScope = (
  selectedProjects: readonly Pick<CollectProjectsSuccessResult, 'packageManager'>[],
  allProjects: readonly Pick<CollectProjectsSuccessResult, 'packageManager'>[]
): { roots: string[]; ignore: string[] } => {
  const upgradedPackageJsonPaths = new Set(
    selectedProjects.flatMap((project) => project.packageManager.packageJsonPaths)
  );
  return {
    roots: [
      ...new Set(
        selectedProjects.map((project) =>
          getInstallRoot(project.packageManager.primaryPackageJson.operationDir)
        )
      ),
    ],
    ignore: allProjects
      .filter((project) => !selectedProjects.includes(project))
      .flatMap((project) => project.packageManager.packageJsonPaths)
      .filter((path) => !upgradedPackageJsonPaths.has(path)),
  };
};

/**
 * Finds package.json files in the install rooted at `cwd` that declare a Storybook package with a
 * range that excludes `version` and only allows older majors, such as `storybook ^10.6.6` after an
 * upgrade to 11. Package.json files under a nested lockfile belong to another install and are
 * skipped, as are ranges that aren't semver ranges (`workspace:`, `catalog:`, `file:`, ...).
 *
 * @param version - The Storybook version the upgrade installed
 * @param options.cwd - Root of the install to search
 * @param options.ignore - package.json paths to skip, such as those of projects left out of the
 *   upgrade on purpose
 */
export const findOutdatedStorybookPackageJsons = async (
  version: string,
  { cwd = getProjectRoot(), ignore = [] }: { cwd?: string; ignore?: readonly string[] } = {}
): Promise<OutdatedStorybookPackageJson[]> => {
  const targetMajor = major(version);
  const ignored = new Set(ignore.map((path) => resolve(path)));
  const paths = await globby([PACKAGE_JSON_PATTERN, ...LOCK_FILES.map((name) => `**/${name}`)], {
    cwd,
    gitignore: true,
    ignore: ['**/node_modules/**'],
    absolute: true,
    followSymbolicLinks: false,
  });
  const root = resolve(cwd);
  const nestedInstallDirs = paths
    .filter((path) => !path.endsWith('/package.json'))
    .map((path) => dirname(path))
    .filter((dir) => dir !== root);
  const packageJsonPaths = paths.filter(
    (path) =>
      path.endsWith('/package.json') &&
      !ignored.has(path) &&
      !nestedInstallDirs.some((dir) => path.startsWith(`${dir}/`))
  );

  const results = await Promise.all(
    packageJsonPaths.map(async (packageJsonPath): Promise<OutdatedStorybookPackageJson | null> => {
      let packageJson: PackageJsonWithDepsAndDevDeps;
      try {
        packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      } catch {
        return null;
      }
      const declared = {
        ...packageJson.peerDependencies,
        ...packageJson.devDependencies,
        ...packageJson.dependencies,
      };
      const dependencies = Object.entries(declared)
        .filter(([name, range]) => {
          if (!(name in versions) || typeof range !== 'string' || !validRange(range)) {
            return false;
          }
          const lowest = minVersion(range);
          // Major 0 is a canary (`0.0.0-pr-...`) or a pre-lockstep release, not an older Storybook
          return (
            lowest !== null &&
            lowest.major > 0 &&
            lowest.major < targetMajor &&
            !satisfies(version, range, { includePrerelease: true })
          );
        })
        .map(([name, range]) => `${name} ${range}`);
      return dependencies.length > 0 ? { packageJsonPath, dependencies } : null;
    })
  );

  return results.filter((result): result is OutdatedStorybookPackageJson => result !== null);
};

/**
 * Warns about package.json files that, after an upgrade, still declare an older Storybook major in
 * the same install as an upgraded project. They usually belong to a Storybook that upgrade didn't
 * find, and leave a second Storybook core in the install.
 */
export const warnAboutOutdatedStorybookPackageJsons = async (
  version: string,
  selectedProjects: readonly Pick<CollectProjectsSuccessResult, 'packageManager'>[],
  allProjects: readonly Pick<CollectProjectsSuccessResult, 'packageManager'>[]
): Promise<OutdatedStorybookPackageJson[]> => {
  let outdated: OutdatedStorybookPackageJson[] = [];
  try {
    const { roots, ignore } = getOutdatedScanScope(selectedProjects, allProjects);
    const results = await Promise.all(
      roots.map((cwd) => findOutdatedStorybookPackageJsons(version, { cwd, ignore }))
    );
    outdated = results.flat();
  } catch (error) {
    logger.debug(`Could not check for outdated Storybook dependencies: ${String(error)}`);
    return [];
  }

  if (outdated.length > 0) {
    const projectRoot = getProjectRoot();
    const list = outdated
      .map(
        ({ packageJsonPath, dependencies }) =>
          `- ${picocolors.cyan(relative(projectRoot, packageJsonPath))}: ${dependencies.join(', ')}`
      )
      .join('\n');
    logger.warn(
      [
        `These package.json files still declare Storybook packages from an older major than ${version}. Your install can end up with two Storybook versions:`,
        list,
        `If they belong to another Storybook, upgrade it as well, for example with ${picocolors.cyan('storybook upgrade --config-dir <its config directory>')}.`,
      ].join('\n')
    );
  }

  return outdated;
};

/**
 * Retrieves the installed version of Storybook from package manager
 *
 * @example
 *
 * ```typescript
 * const version = await getInstalledStorybookVersion(packageManager);
 * console.log(version); // "7.0.0" or undefined
 * ```
 *
 * @param packageManager - Package manager instance
 * @returns Promise resolving to installed version string or undefined
 */
export const getInstalledStorybookVersion = async (
  packageManager: JsPackageManager
): Promise<string | undefined> => {
  try {
    // First try to get the storybook CLI version directly
    const storybookCliVersion = await packageManager.getInstalledVersion('storybook');
    if (storybookCliVersion) {
      return storybookCliVersion;
    }

    // Fallback to checking all Storybook packages
    const installations = await packageManager.findInstallations(Object.keys(versions));
    if (!installations?.dependencies) {
      return undefined;
    }

    // Get the first available version from dependencies
    const firstDependency = Object.entries(installations.dependencies)[0];
    return firstDependency?.[1]?.[0]?.version;
  } catch (error) {
    logger.warn('Failed to get installed Storybook version');
    return undefined;
  }
};

/**
 * Processes a single Storybook project and collects its data
 *
 * @param configDir - Path to the Storybook configuration directory
 * @param options - Upgrade options
 * @param currentCLIVersion - Current CLI version
 * @returns Promise resolving to project collection result
 */
const processProject = async ({
  configDir,
  options,
  currentCLIVersion,
  onScanStart,
}: {
  configDir: string;
  options: UpgradeOptions;
  currentCLIVersion: string;
  onScanStart: () => void;
}): Promise<CollectProjectsResult> => {
  try {
    onScanStart();
    const name = configDir.replace(getProjectRoot(), '');

    logger.debug(`Getting Storybook data...`);
    const {
      configDir: resolvedConfigDir,
      mainConfig,
      mainConfigPath,
      packageManager,
      previewConfigPath,
      storiesPaths,
      versionSpecifier,
      versionInstalled,
    } = await getStorybookData({ configDir, packageManagerName: options.packageManager });

    // Validate version and upgrade compatibility
    logger.debug(`${name} - Validating before version... ${versionInstalled}`);
    validateVersion(versionInstalled);
    const isCanary =
      isCanaryVersion(currentCLIVersion) ||
      isCanaryVersion(versionInstalled) ||
      isPkgPrNewVersionSpecifier(versionSpecifier);
    logger.debug(`${name} - Validating upgrade compatibility...`);
    validateUpgradeCompatibility(currentCLIVersion, versionInstalled, isCanary);

    // Get version information from NPM
    logger.debug(`${name} - Fetching NPM version information...`);
    const [latestCLIVersionOnNPM, latestPrereleaseCLIVersionOnNPM] = await Promise.all([
      packageManager.latestVersion('storybook'),
      packageManager.latestVersion('storybook@next'),
    ]);

    if (latestCLIVersionOnNPM == null) {
      logger.debug(
        `${name} - Could not determine the latest Storybook version from the registry; skipping the outdated-version check.`
      );
    }

    // Calculate version flags
    const isCLIOutdated =
      latestCLIVersionOnNPM != null && lt(currentCLIVersion, latestCLIVersionOnNPM);
    const isCLIExactLatest = currentCLIVersion === latestCLIVersionOnNPM;
    const isCLIPrerelease = prerelease(currentCLIVersion) !== null;
    const isCLIExactPrerelease = currentCLIVersion === latestPrereleaseCLIVersionOnNPM;
    const isUpgrade = lt(versionInstalled, currentCLIVersion);

    // Check for blockers
    let autoblockerCheckResults: AutoblockerResult<unknown>[] | null = null;

    if (
      typeof mainConfig !== 'boolean' &&
      typeof mainConfigPath !== 'undefined' &&
      !options.force
    ) {
      logger.debug(`${name} - Evaluating blockers...`);
      autoblockerCheckResults = await autoblock({
        packageManager,
        configDir: resolvedConfigDir,
        mainConfig,
        mainConfigPath,
        previewConfigPath,
        storiesPaths,
      });
    }

    return {
      configDir: resolvedConfigDir,
      mainConfig,
      mainConfigPath,
      packageManager,
      isCanary,
      isCLIOutdated,
      isCLIPrerelease,
      isCLIExactLatest,
      isUpgrade,
      beforeVersion: versionInstalled,
      currentCLIVersion,
      latestCLIVersionOnNPM,
      isCLIExactPrerelease,
      storybookVersionSpecifier: versionSpecifier,
      autoblockerCheckResults,
      previewConfigPath,
      storiesPaths,
    } satisfies CollectProjectsSuccessResult;
  } catch (error) {
    logger.debug(String(error));
    return {
      configDir,
      error: error as Error,
    } satisfies CollectProjectsErrorResult;
  }
};

/**
 * Collects data from multiple Storybook projects
 *
 * @example
 *
 * ```typescript
 * const results = await collectProjects(options, ['/path/to/.storybook']);
 * const successResults = results.filter(isSuccessResult);
 * ```
 *
 * @param options - Upgrade options
 * @param configDirs - Array of configuration directory paths
 * @returns Promise resolving to array of collection results
 */
export const collectProjects = async (
  options: UpgradeOptions,
  configDirs: readonly string[],
  onProjectScanStart: () => void
): Promise<CollectProjectsResult[]> => {
  const { default: pLimit } = await import('p-limit');

  const currentCLIVersion = versions.storybook;
  const limit = pLimit(5); // Process 5 projects concurrently

  const projectPromises = configDirs.map((configDir) =>
    limit(() =>
      processProject({
        configDir,
        options,
        currentCLIVersion,
        onScanStart: () => onProjectScanStart(),
      })
    )
  );

  const result = await Promise.all(projectPromises);

  return result;
};

/**
 * Generates upgrade specifications for dependencies
 *
 * @param dependencies - Dependencies object from package.json
 * @param config - Upgrade configuration
 * @returns Promise resolving to array of upgrade specifications
 */
export const generateUpgradeSpecs = async (
  dependencies: PackageJsonWithDepsAndDevDeps['dependencies'] = {},
  config: UpgradeConfig
): Promise<string[]> => {
  const {
    packageManager,
    isCanary,
    isCLIOutdated,
    isCLIPrerelease,
    isCLIExactPrerelease,
    isCLIExactLatest,
  } = config;
  const prereleaseModifier = isCLIExactPrerelease && !isCanary ? '^' : '';

  // Filter for monorepo dependencies
  const monorepoDependencies = Object.keys(dependencies).filter(
    (dependency): dependency is keyof typeof versions => dependency in versions
  );

  // Generate core Storybook upgrades
  const storybookCoreUpgrades = monorepoDependencies.map((dependency) => {
    const versionSpec = dependencies[dependency];

    const pkgPrNewSpecifier = getPkgPrNewPackageSpecifier(
      dependency,
      config.storybookVersionSpecifier
    );

    if (pkgPrNewSpecifier) {
      return `${dependency}@${pkgPrNewSpecifier}`;
    }

    if (!versionSpec) {
      return `${dependency}@${versions[dependency]}`;
    }

    const { modifier } = getVersionModifier(versionSpec);

    const finalModifier = isCLIPrerelease
      ? prereleaseModifier
      : isCLIOutdated || isCanary
        ? ''
        : modifier;

    return `${dependency}@${finalModifier}${versions[dependency]}`;
  });

  // Generate satellite addon upgrades if applicable
  let storybookSatelliteUpgrades: string[] = [];
  if (isCLIExactPrerelease || isCLIExactLatest) {
    const satelliteDependencies = Object.keys(dependencies).filter(
      (dependency) =>
        isSatelliteAddon(dependency) && !dependencies[dependency]?.startsWith('workspace:')
    );

    if (satelliteDependencies.length > 0) {
      try {
        const upgradePromises = satelliteDependencies.map(async (dependency) => {
          try {
            const tags = isCLIPrerelease ? [dependency, `${dependency}@next`] : [dependency];
            const versions = await Promise.all(
              tags.map((tag) => packageManager.latestVersion(tag))
            );
            const [mostRecentVersion] = rsort(versions.filter((version) => version !== null));
            if (!mostRecentVersion) {
              return null;
            }
            const { modifier } = getVersionModifier(dependencies[dependency] ?? '');
            const finalModifier =
              isCLIPrerelease && prerelease(mostRecentVersion) ? prereleaseModifier : modifier;
            return `${dependency}@${finalModifier}${mostRecentVersion}`;
          } catch {
            return null;
          }
        });

        const results = await Promise.all(upgradePromises);
        storybookSatelliteUpgrades = results.filter((result): result is string => result !== null);
      } catch (error) {
        logger.warn('Failed to fetch satellite dependencies');
        // Continue without satellite upgrades
      }
    }
  }

  return [...storybookCoreUpgrades, ...storybookSatelliteUpgrades];
};

/**
 * Upgrades Storybook dependencies across all package.json files
 *
 * @example
 *
 * ```typescript
 * await upgradeStorybookDependencies({
 *   packageManager,
 *   isCanary: false,
 *   isCLIOutdated: false,
 *   isCLIPrerelease: false,
 *   isCLIExactPrerelease: false,
 *   isCLIExactLatest: true,
 * });
 * ```
 *
 * @param config - Upgrade configuration
 */
export const upgradeStorybookDependencies = async (config: UpgradeConfig): Promise<void> => {
  const { packageManager } = config;

  for (const packageJsonPath of packageManager.packageJsonPaths) {
    const packageJson = JsPackageManager.getPackageJson(packageJsonPath);

    const [upgradedDependencies, upgradedDevDependencies, upgradedPeerDependencies] =
      await Promise.all([
        generateUpgradeSpecs(packageJson.dependencies, config),
        generateUpgradeSpecs(packageJson.devDependencies, config),
        generateUpgradeSpecs(packageJson.peerDependencies, config),
      ]);

    logger.debug(JSON.stringify({ upgradedDependencies }, null, 2));
    logger.debug(JSON.stringify({ upgradedDevDependencies }, null, 2));
    logger.debug(JSON.stringify({ upgradedPeerDependencies }, null, 2));

    const upgrades: [DependencyType, string[]][] = [
      ['dependencies', upgradedDependencies],
      ['devDependencies', upgradedDevDependencies],
      ['peerDependencies', upgradedPeerDependencies],
    ];

    for (const [type, specifiers] of upgrades) {
      const directSpecifiers = packageManager.writeCatalogUpgrades(
        specifiers,
        packageJson[type] ?? {}
      );
      await packageManager.addDependencies(
        {
          type,
          skipInstall: true,
          packageJsonInfo: JsPackageManager.getPackageJsonInfo(packageJsonPath),
        },
        directSpecifiers
      );
    }
  }
};

/**
 * Formats project directories for display
 *
 * @param projectData - Array of project results
 * @param modifier - Symbol to prefix each directory
 * @returns Formatted string of project directories
 */
const formatProjectDirectories = (
  projectData: readonly CollectProjectsResult[],
  modifier: string
): string => {
  if (projectData.length === 0) {
    return '';
  }

  return projectData
    .map((project) => project.configDir)
    .map((dir) => `${modifier} ${picocolors.cyan(shortenPath(dir))}`)
    .join('\n');
};

/**
 * Shortens a path to the relative path from the project root
 *
 * @param path - The path to shorten
 * @returns The shortened path
 */
export const shortenPath = (path: string) => {
  return normalize(path).replace(normalize(getProjectRoot()), '');
};

/**
 * Handles multiple project selection and validation
 *
 * @param validProjects - Array of valid project results
 * @param errorProjects - Array of error project results
 * @param detectedConfigDirs - Array of detected configuration directories
 * @returns Promise resolving to selected projects or undefined
 */
const handleMultipleProjects = async (
  validProjects: readonly CollectProjectsSuccessResult[],
  errorProjects: readonly CollectProjectsErrorResult[],
  detectedConfigDirs: readonly string[],
  yes: boolean
): Promise<CollectProjectsSuccessResult[] | undefined> => {
  // Check for overlapping Storybooks
  const allPackageJsonPaths = validProjects
    .flatMap((data) => data.packageManager.packageJsonPaths)
    .filter(JsPackageManager.hasAnyStorybookDependency);

  const uniquePackageJsonPaths = new Set(allPackageJsonPaths);
  const hasOverlappingStorybooks = uniquePackageJsonPaths.size !== allPackageJsonPaths.length;

  if (hasOverlappingStorybooks) {
    const projectsFoundMessage = [
      'Multiple Storybook projects found. Storybook can only upgrade all projects at once:',
    ];
    if (validProjects.length > 0) {
      projectsFoundMessage.push(formatProjectDirectories(validProjects, logger.SYMBOLS.success));
    }
    if (errorProjects.length > 0) {
      logTracker.enableLogWriting();
      projectsFoundMessage.push(
        `There were some errors while collecting data for the following projects:\n${formatProjectDirectories(errorProjects, logger.SYMBOLS.error)}`,
        '',
        'Full logs will be available in the Storybook debug logs at the end of the run.'
      );
    }
    logger.log(projectsFoundMessage.join('\n'));

    const continueUpgrade =
      yes ||
      (await prompt.confirm({
        message: 'Continue with the upgrade?',
        initialValue: true,
      }));

    if (!continueUpgrade) {
      throw new HandledError('Upgrade cancelled by user');
    }

    return [...validProjects];
  }

  if (detectedConfigDirs.length > 1) {
    const selectedConfigDirs = await prompt.multiselect({
      message: 'Select which projects to upgrade',
      options: detectedConfigDirs.map((configDir) => ({
        label: shortenPath(configDir),
        value: configDir,
      })),
    });

    return validProjects.filter((data) => selectedConfigDirs.includes(data.configDir));
  }

  return undefined;
};

/**
 * Gets and validates Storybook projects for upgrade
 *
 * @example
 *
 * ```typescript
 * const result = await getProjects({ configDir: ['/path/to/.storybook'] });
 * if (result) {
 *   console.log(
 *     `Found ${result.selectedProjects.length} of ${result.allProjects.length} projects to upgrade`
 *   );
 * }
 * ```
 *
 * @param options - Upgrade options
 * @returns Promise resolving to object with all detected projects and selected projects, or
 *   undefined
 */
export const getProjects = async (
  options: UpgradeOptions
): Promise<
  | {
      allProjects: CollectProjectsSuccessResult[];
      selectedProjects: CollectProjectsSuccessResult[];
      /** The Storybooks that were found but could not be read, so they are in neither list. */
      unreadProjects: number;
    }
  | undefined
> => {
  try {
    const task = prompt.spinner({ id: 'detect-projects' });
    task.start('Detecting projects...');

    // Determine configuration directories
    let detectedConfigDirs: string[] = options.configDir ?? [];
    if (!options.configDir || options.configDir.length === 0) {
      detectedConfigDirs = await findStorybookProjects();
    }
    if (detectedConfigDirs.length === 0) {
      task.stop('No .storybook directory found');
      if (options.yes) {
        throw new UpgradeStorybookConfigDirNotFoundError();
      }
      const configDir = await prompt.text({
        message:
          'No Storybook projects were found. Please enter the path to the .storybook directory for the project you want to upgrade.',
      });
      detectedConfigDirs = [configDir];
      task.start('Detecting projects...');
    }

    let count = 0;
    const projects = await collectProjects(options, detectedConfigDirs, () =>
      task.message(`Detecting projects: ${++count} projects`)
    );
    task.stop(`${projects.length} ${projects.length > 1 ? 'projects' : 'project'} detected`);

    // Separate valid and error projects
    const validProjects = projects.filter(isSuccessResult);
    const errorProjects = projects.filter(isErrorResult);
    logger.debug(
      `Found ${validProjects.length} valid projects and ${errorProjects.length} error projects`
    );

    // Handle single project case
    if (validProjects.length === 1) {
      return {
        allProjects: validProjects,
        selectedProjects: validProjects,
        unreadProjects: errorProjects.length,
      };
    }

    // Handle case with only errors
    if (validProjects.length === 0 && errorProjects.length > 0) {
      const errorMessage = errorProjects
        .map((project) => {
          const relativePath = shortenPath(project.configDir);
          return `${relativePath}:\n${project.error.stack || project.error.message}`;
        })
        .join('\n');

      throw new Error(
        `❌ Storybook found errors while collecting data for the following projects:\n${errorMessage}\nPlease fix the errors and run the upgrade command again.`
      );
    }

    // Handle multiple projects
    const selectedProjects = await handleMultipleProjects(
      validProjects,
      errorProjects,
      detectedConfigDirs,
      options.yes
    );

    return selectedProjects
      ? { allProjects: validProjects, selectedProjects, unreadProjects: errorProjects.length }
      : undefined;
  } catch (error) {
    if (
      !(error instanceof HandledError || error instanceof UpgradeStorybookConfigDirNotFoundError)
    ) {
      logger.error('Failed to get projects');
    }

    throw error;
  }
};

/** Finds files in the directory tree up to the project root */
export const findFilesUp = (matchers: string[], cwd: string) => {
  const matchingFiles: string[] = [];
  for (const directory of walk.up(cwd, { last: getProjectRoot() })) {
    // The matchers only name files directly inside `directory`, so `gitignore: true` would only add
    // a read of every .gitignore below it, which takes seconds per call in a large monorepo.
    matchingFiles.push(...globbySync(matchers, { absolute: true, cwd: directory }));
  }

  return matchingFiles;
};

/**
 * Gets story file paths from a Storybook configuration directory
 *
 * @example
 *
 * ```typescript
 * const storiesPaths = await getStoriesPathsFromConfig(
 *   '/path/to/.storybook',
 *   '/path/to/project'
 * );
 * ```
 *
 * @param configDir - Path to the Storybook configuration directory
 * @param workingDir - Working directory for resolving relative paths
 * @returns Promise resolving to array of story file paths
 */
export const getEvaluatedStoryPaths = async (
  configDir: string,
  workingDir: string
): Promise<string[]> => {
  const { presets } = await experimental_loadStorybook({
    configDir,
    packageJson: {},
  });

  const stories = await presets.apply('stories', []);

  return getStoriesPathsFromConfig({
    stories,
    configDir,
    workingDir,
  });
};
