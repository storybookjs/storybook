import type { PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';
import { HandledError, JsPackageManager, normalizeStories } from 'storybook/internal/common';
import { getProjectRoot, isSatelliteAddon, versions } from 'storybook/internal/common';
import { StoryIndexGenerator, experimental_loadStorybook } from 'storybook/internal/core-server';
import { logTracker, logger, prompt } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as walk from 'empathic/walk';
// eslint-disable-next-line depend/ban-dependencies
import { globby, globbySync } from 'globby';
import picocolors from 'picocolors';
import { lt, prerelease } from 'semver';

import { autoblock } from './autoblock';
import type { AutoblockerResult } from './autoblock/types';
import { getStorybookData } from './automigrate/helpers/mainConfigFile';
import { type UpgradeOptions } from './upgrade';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/** Configuration for upgrading Storybook dependencies */
interface UpgradeConfig {
  readonly packageManager: JsPackageManager;
  readonly isCanary: boolean;
  readonly isCLIOutdated: boolean;
  readonly isCLIPrerelease: boolean;
  readonly isCLIExactPrerelease: boolean;
  readonly isCLIExactLatest: boolean;
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
  readonly latestCLIVersionOnNPM: string;
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
const isCanaryVersion = (version: string): boolean =>
  version.startsWith('0.0.0') || version.startsWith('portal:') || version.startsWith('workspace:');

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
    // Find all .storybook directories, accounting for custom config dirs later
    const storybookDirs = await globby(STORYBOOK_DIR_PATTERN, {
      cwd,
      dot: true,
      gitignore: true,
      absolute: true,
      onlyDirectories: true,
      followSymbolicLinks: false,
    });

    logger.debug(`Found ${storybookDirs.length} Storybook projects`);

    if (storybookDirs.length === 0) {
      const answer = await prompt.text({
        message:
          'No Storybook projects were found. Please enter the path to the .storybook directory for the project you want to upgrade.',
      });
      return [answer];
    }

    return storybookDirs;
  } catch (error) {
    logger.error('Failed to find Storybook projects');
    throw error;
  }
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
      storybookVersion: beforeVersion,
    } = await getStorybookData({ configDir });

    // Validate version and upgrade compatibility
    logger.debug(`${name} - Validating before version... ${beforeVersion}`);
    validateVersion(beforeVersion);
    const isCanary = isCanaryVersion(currentCLIVersion) || isCanaryVersion(beforeVersion);
    logger.debug(`${name} - Validating upgrade compatibility...`);
    validateUpgradeCompatibility(currentCLIVersion, beforeVersion, isCanary);

    // Get version information from NPM
    logger.debug(`${name} - Fetching NPM version information...`);
    const [latestCLIVersionOnNPM, latestPrereleaseCLIVersionOnNPM] = await Promise.all([
      packageManager.latestVersion('storybook'),
      packageManager.latestVersion('storybook@next'),
    ]);

    // Calculate version flags
    const isCLIOutdated = lt(currentCLIVersion, latestCLIVersionOnNPM!);
    const isCLIExactLatest = currentCLIVersion === latestCLIVersionOnNPM;
    const isCLIPrerelease = prerelease(currentCLIVersion) !== null;
    const isCLIExactPrerelease = currentCLIVersion === latestPrereleaseCLIVersionOnNPM;
    const isUpgrade = lt(beforeVersion, currentCLIVersion);

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
      beforeVersion,
      currentCLIVersion,
      latestCLIVersionOnNPM: latestCLIVersionOnNPM!,
      isCLIExactPrerelease,
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

  // Filter for monorepo dependencies
  const monorepoDependencies = Object.keys(dependencies).filter(
    (dependency): dependency is keyof typeof versions => dependency in versions
  );

  // Generate core Storybook upgrades
  const storybookCoreUpgrades = monorepoDependencies.map((dependency) => {
    const versionSpec = dependencies[dependency];

    if (!versionSpec) {
      return `${dependency}@${versions[dependency]}`;
    }

    const { modifier } = getVersionModifier(versionSpec);

    // Use fixed version for outdated CLI or canary versions
    const shouldUseFixed = isCLIOutdated || isCanary;
    const finalModifier = shouldUseFixed ? '' : modifier;

    return `${dependency}@${finalModifier}${versions[dependency]}`;
  });

  // Generate satellite addon upgrades if applicable
  let storybookSatelliteUpgrades: string[] = [];
  if (isCLIExactPrerelease || isCLIExactLatest) {
    const satelliteDependencies = Object.keys(dependencies).filter(isSatelliteAddon);

    if (satelliteDependencies.length > 0) {
      try {
        const upgradePromises = satelliteDependencies.map(async (dependency) => {
          try {
            const packageName = isCLIPrerelease ? `${dependency}@next` : dependency;
            const mostRecentVersion = (await packageManager.latestVersion(packageName))!;
            if (!mostRecentVersion) {
              return null;
            }
            const { modifier } = getVersionModifier(dependencies[dependency] ?? '');
            return `${dependency}@${modifier}${mostRecentVersion}`;
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

    await packageManager.addDependencies(
      {
        type: 'dependencies',
        skipInstall: true,
        packageJsonInfo: JsPackageManager.getPackageJsonInfo(packageJsonPath),
      },
      upgradedDependencies
    );

    await packageManager.addDependencies(
      {
        type: 'devDependencies',
        skipInstall: true,
        packageJsonInfo: JsPackageManager.getPackageJsonInfo(packageJsonPath),
      },
      upgradedDevDependencies
    );

    await packageManager.addDependencies(
      {
        type: 'peerDependencies',
        skipInstall: true,
        packageJsonInfo: JsPackageManager.getPackageJsonInfo(packageJsonPath),
      },
      upgradedPeerDependencies
    );
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
  const gitRoot = getProjectRoot();
  return path.replace(gitRoot, '');
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
      return { allProjects: validProjects, selectedProjects: validProjects };
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

    return selectedProjects ? { allProjects: validProjects, selectedProjects } : undefined;
  } catch (error) {
    if (!(error instanceof HandledError)) {
      logger.error('Failed to get projects');
    }

    throw error;
  }
};

/** Finds files in the directory tree up to the project root */
export const findFilesUp = (matchers: string[], cwd: string) => {
  const matchingFiles: string[] = [];
  for (const directory of walk.up(cwd, { last: getProjectRoot() })) {
    matchingFiles.push(
      ...globbySync(matchers, {
        gitignore: true,
        absolute: true,
        cwd: directory,
      })
    );
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

/**
 * Gets story file paths from a Storybook configuration directory
 *
 * @example
 *
 * ```typescript
 * const storiesPaths = await getStoriesPathsFromConfigWithoutEvaluating({
 *   stories: ['src\/**\/*.stories.tsx'],
 *   configDir: '/path/to/.storybook',
 *   workingDir: '/path/to/project',
 * });
 * ```
 */
export const getStoriesPathsFromConfig = async ({
  stories,
  configDir,
  workingDir,
}: {
  stories: StorybookConfigRaw['stories'];
  configDir: string;
  workingDir: string;
}) => {
  if (stories.length === 0) {
    return [];
  }

  const normalizedStories = normalizeStories(stories, {
    configDir,
    workingDir,
  });

  const matchingStoryFiles = await StoryIndexGenerator.findMatchingFilesForSpecifiers(
    normalizedStories,
    workingDir,
    true
  );

  const storiesPaths = matchingStoryFiles.flatMap(([specifier, cache]) => {
    return StoryIndexGenerator.storyFileNames(new Map([[specifier, cache]]));
  });

  return storiesPaths;
};
