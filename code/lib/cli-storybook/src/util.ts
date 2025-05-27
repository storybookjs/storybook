import type { PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';
import { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isSatelliteAddon, prompt, versions } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import boxen, { type Options } from 'boxen';
// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import picocolors from 'picocolors';
import { lt, prerelease } from 'semver';

import { autoblock } from './autoblock/index';
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
  readonly configDir: string;
  readonly mainConfig: StorybookConfigRaw;
  readonly mainConfigPath: string | undefined;
  readonly previewConfigPath: string | undefined;
  readonly isUpgrade: boolean;
  readonly beforeVersion: string;
  readonly currentCLIVersion: string;
  readonly latestCLIVersionOnNPM: string;
  // TODO: figure out this type
  readonly blockers: unknown;
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

/** Maximum number of projects to process simultaneously */
const MAX_PROJECTS_TO_PROCESS = 4;

/** Default boxen styling for messages */
const DEFAULT_BOXEN_STYLE: Options = {
  borderStyle: 'round',
  padding: 1,
  borderColor: '#F1618C',
} as const;

/** Glob pattern for finding Storybook directories */
const STORYBOOK_DIR_PATTERN = '**/.storybook';

/** Default fallback version when none is found */
const DEFAULT_FALLBACK_VERSION = '0.0.0';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a styled boxed message for console output
 *
 * @example
 *
 * ```typescript
 * const message = printBoxedMessage('Hello World!');
 * console.log(message);
 * ```
 *
 * @param message - The message to display in the box
 * @param style - Optional styling options for the box
 * @returns Formatted boxed message string
 */
export const printBoxedMessage = (message: string, style?: Options): string =>
  boxen(message, { ...DEFAULT_BOXEN_STYLE, ...style });

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
    // Find all .storybook directories, accounting for custom config dirs later
    const storybookDirs = await globby(STORYBOOK_DIR_PATTERN, {
      cwd,
      dot: true,
      gitignore: true,
      absolute: true,
      onlyDirectories: true,
    });

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
const processProject = async (
  configDir: string,
  options: UpgradeOptions,
  currentCLIVersion: string
): Promise<CollectProjectsResult> => {
  logger.plain(`Scanning ${picocolors.cyan(configDir)}`);

  try {
    const {
      configDir: resolvedConfigDir,
      mainConfig,
      mainConfigPath,
      packageManager,
      previewConfigPath,
    } = await getStorybookData({ configDir });

    const beforeVersion =
      (await getInstalledStorybookVersion(packageManager)) ?? DEFAULT_FALLBACK_VERSION;

    // Validate version and upgrade compatibility
    validateVersion(beforeVersion);
    const isCanary = isCanaryVersion(currentCLIVersion) || isCanaryVersion(beforeVersion);
    validateUpgradeCompatibility(currentCLIVersion, beforeVersion, isCanary);

    // Get version information from NPM
    const [latestCLIVersionOnNPM, latestPrereleaseCLIVersionOnNPM] = await Promise.all([
      packageManager.latestVersion('storybook'),
      packageManager.latestVersion('storybook@next'),
    ]);

    // Calculate version flags
    const isCLIOutdated = lt(currentCLIVersion, latestCLIVersionOnNPM);
    const isCLIExactLatest = currentCLIVersion === latestCLIVersionOnNPM;
    const isCLIPrerelease = prerelease(currentCLIVersion) !== null;
    const isCLIExactPrerelease = currentCLIVersion === latestPrereleaseCLIVersionOnNPM;
    const isUpgrade = lt(beforeVersion, currentCLIVersion);

    // Check for blockers
    let blockers: unknown;
    if (
      typeof mainConfig !== 'boolean' &&
      typeof mainConfigPath !== 'undefined' &&
      !options.force
    ) {
      blockers = await autoblock({
        packageManager,
        configDir: resolvedConfigDir,
        packageJson: packageManager.primaryPackageJson.packageJson,
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
      latestCLIVersionOnNPM,
      isCLIExactPrerelease,
      blockers,
      previewConfigPath,
    } satisfies CollectProjectsSuccessResult;
  } catch (error) {
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
  configDirs: readonly string[]
): Promise<CollectProjectsResult[]> => {
  const currentCLIVersion = versions.storybook;

  const projectPromises = configDirs.map((configDir) =>
    processProject(configDir, options, currentCLIVersion)
  );

  return Promise.all(projectPromises);
};

/**
 * Generates upgrade specifications for dependencies
 *
 * @param dependencies - Dependencies object from package.json
 * @param config - Upgrade configuration
 * @returns Promise resolving to array of upgrade specifications
 */
const generateUpgradeSpecs = async (
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
            const mostRecentVersion = await packageManager.latestVersion(packageName);
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
 * Adds dependencies to package.json
 *
 * @param packageManager - Package manager instance
 * @param dependencies - Array of dependency specifications
 * @param isDev - Whether these are dev dependencies
 */
const addDependencies = async (
  packageManager: JsPackageManager,
  dependencies: readonly string[],
  isDev: boolean
): Promise<void> => {
  if (dependencies.length === 0) {
    return;
  }

  try {
    await packageManager.addDependencies({ installAsDevDependencies: isDev, skipInstall: true }, [
      ...dependencies,
    ]);
  } catch (error) {
    logger.error(`Failed to add ${isDev ? 'dev ' : ''}dependencies`);
    throw error;
  }
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

  logger.info(`Updating dependencies in ${picocolors.cyan('package.json')}...`);

  for (const packageJsonPath of packageManager.packageJsonPaths) {
    try {
      const packageJson = JsPackageManager.getPackageJson(packageJsonPath);

      const [upgradedDependencies, upgradedDevDependencies] = await Promise.all([
        generateUpgradeSpecs(packageJson.dependencies, config),
        generateUpgradeSpecs(packageJson.devDependencies, config),
      ]);

      await Promise.all([
        addDependencies(packageManager, upgradedDependencies, false),
        addDependencies(packageManager, upgradedDevDependencies, true),
      ]);
    } catch (error) {
      logger.error(`Failed to upgrade dependencies in ${packageJsonPath}`);
      throw error;
    }
  }
};

/**
 * Formats project directories for display
 *
 * @param projectData - Array of project results
 * @param modifier - Symbol to prefix each directory
 * @param gitRoot - Git root path for relative path calculation
 * @returns Formatted string of project directories
 */
const formatProjectDirectories = (
  projectData: readonly CollectProjectsResult[],
  modifier: string,
  gitRoot: string
): string => {
  if (projectData.length === 0) {
    return '';
  }

  return projectData
    .map((project) => project.configDir)
    .map((dir) => `${modifier} ${picocolors.cyan(dir.replace(gitRoot, ''))}`)
    .join('\n');
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
  detectedConfigDirs: readonly string[]
): Promise<CollectProjectsSuccessResult[] | undefined> => {
  const gitRoot = getProjectRoot();

  // Check for overlapping Storybooks
  const allPackageJsonPaths = validProjects
    .flatMap((data) => data.packageManager.packageJsonPaths)
    .filter(JsPackageManager.hasAnyStorybookDependency);

  const uniquePackageJsonPaths = new Set(allPackageJsonPaths);
  const hasOverlappingStorybooks = uniquePackageJsonPaths.size !== allPackageJsonPaths.length;

  if (hasOverlappingStorybooks) {
    const validProjectsMessage = formatProjectDirectories(validProjects, '✔', gitRoot);
    const invalidProjectsMessage =
      errorProjects.length > 0
        ? `\nThere were some errors while collecting data for the following projects:\n${formatProjectDirectories(errorProjects, '✕', gitRoot)}`
        : '';

    logger.plain(
      `Multiple Storybook projects found. Storybook can only upgrade all projects at once:\n${validProjectsMessage}${invalidProjectsMessage}`
    );

    const continueUpgrade = await prompt.confirm({
      message: 'Continue with the upgrade?',
      initialValue: true,
    });

    if (!continueUpgrade) {
      process.exit(0);
    }

    return [...validProjects];
  }

  if (detectedConfigDirs.length > 1) {
    const selectedConfigDirs = await prompt.multiselect({
      message: 'Select which projects to upgrade',
      options: detectedConfigDirs.map((configDir) => ({
        label: configDir.replace(gitRoot, ''),
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
 * const projects = await getProjects({ configDir: ['/path/to/.storybook'] });
 * if (projects) {
 *   console.log(`Found ${projects.length} projects to upgrade`);
 * }
 * ```
 *
 * @param options - Upgrade options
 * @returns Promise resolving to array of valid projects or undefined
 */
export const getProjects = async (
  options: UpgradeOptions
): Promise<CollectProjectsSuccessResult[] | undefined> => {
  try {
    const gitRoot = getProjectRoot();

    // Determine configuration directories
    let detectedConfigDirs: string[] = options.configDir ?? [];
    if (!options.configDir || options.configDir.length === 0) {
      detectedConfigDirs = await findStorybookProjects();
    }

    // Limit the number of projects processed simultaneously
    // TODO: Remove once done with testing
    const configDirsToProcess = detectedConfigDirs.slice(0, MAX_PROJECTS_TO_PROCESS);
    const projects = await collectProjects(options, configDirsToProcess);

    // Separate valid and error projects
    const validProjects = projects.filter(isSuccessResult);
    const errorProjects = projects.filter(isErrorResult);

    // Handle single project case
    if (validProjects.length === 1) {
      return validProjects;
    }

    // Handle case with only errors
    if (validProjects.length === 0 && errorProjects.length > 0) {
      const errorMessage = errorProjects
        .map((project) => {
          const relativePath = project.configDir.replace(gitRoot, '');
          return `${picocolors.cyan(relativePath)}:\n${project.error.message}`;
        })
        .join('\n');

      logger.plain(
        `❌ Storybook found errors while collecting data for the following projects:\n${errorMessage}`
      );
      logger.plain('Please fix the errors and run the upgrade command again.');
      return [];
    }

    // Handle multiple projects
    return handleMultipleProjects(validProjects, errorProjects, detectedConfigDirs);
  } catch (error) {
    logger.error('Failed to get projects');
    throw error;
  }
};
