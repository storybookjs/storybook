import type { PackageJsonWithDepsAndDevDeps } from 'storybook/internal/common';
import { JsPackageManager } from 'storybook/internal/common';
import { getProjectRoot, isSatelliteAddon, prompt, versions } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';

import boxen, { type Options } from 'boxen';
// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import picocolors from 'picocolors';
import { lt, prerelease } from 'semver';

import { autoblock } from './autoblock/index';
import { getStorybookData } from './automigrate/helpers/mainConfigFile';
import { type UpgradeOptions } from './upgrade';

export type CollectProjectsSuccessResult = {
  configDir: string;
  mainConfig: any; // The actual type depends on the mainConfig structure
  mainConfigPath: string | undefined;
  packageManager: any; // JsPackageManager type
  isCanary: boolean;
  isCLIOutdated: boolean;
  isCLIPrerelease: boolean;
  isCLIExactLatest: boolean;
  isUpgrade: boolean;
  beforeVersion: string;
  currentCLIVersion: string;
  latestCLIVersionOnNPM: string;
  isCLIExactPrerelease: boolean;
  blockers: any; // Result from autoblock function
};

type CollectProjectsErrorResult = {
  configDir: string;
  error: any; // The caught error
};

// Union type representing either success or error result
export type CollectProjectsResult = CollectProjectsSuccessResult | CollectProjectsErrorResult;

export const printBoxedMessage = (message: string, style?: Options) =>
  boxen(message, { borderStyle: 'round', padding: 1, borderColor: '#F1618C', ...style });

export const findStorybookProjects = async (cwd: string = process.cwd()): Promise<string[]> => {
  // Find all .storybook directories, though we need to later on account for custom config dirs
  const storybookDirs = await globby('**/.storybook', {
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
};

export function isSuccessResult(
  result: CollectProjectsResult
): result is CollectProjectsSuccessResult {
  return !('error' in result);
}

export function isErrorResult(result: CollectProjectsResult): result is CollectProjectsErrorResult {
  return 'error' in result;
}

export const collectProjects = async (
  options: UpgradeOptions,
  configDirs: string[]
): Promise<CollectProjectsResult[]> => {
  const currentCLIVersion = versions.storybook;

  const upgradeData = configDirs.map(async (_configDir) => {
    logger.plain(`Scanning ${picocolors.cyan(_configDir)}`);
    try {
      const { configDir, mainConfig, mainConfigPath, packageManager } = await getStorybookData({
        configDir: _configDir,
      });

      const beforeVersion = (await getInstalledStorybookVersion(packageManager)) ?? '0.0.0';

      // GUARDS
      if (!beforeVersion) {
        throw new UpgradeStorybookUnknownCurrentVersionError();
      }

      const isCanary =
        currentCLIVersion.startsWith('0.0.0') ||
        beforeVersion.startsWith('portal:') ||
        beforeVersion.startsWith('workspace:');

      if (!isCanary && lt(currentCLIVersion, beforeVersion)) {
        throw new UpgradeStorybookToLowerVersionError({
          beforeVersion,
          currentVersion: currentCLIVersion,
        });
      }

      const latestCLIVersionOnNPM = await packageManager.latestVersion('storybook');
      const latestPrereleaseCLIVersionOnNPM = await packageManager.latestVersion('storybook@next');

      const isCLIOutdated = lt(currentCLIVersion, latestCLIVersionOnNPM);
      const isCLIExactLatest = currentCLIVersion === latestCLIVersionOnNPM;
      const isCLIPrerelease = prerelease(currentCLIVersion) !== null;
      const isCLIExactPrerelease = currentCLIVersion === latestPrereleaseCLIVersionOnNPM;

      const isUpgrade = lt(beforeVersion, currentCLIVersion);

      let blockResult;

      // BLOCKERS
      if (
        typeof mainConfig !== 'boolean' &&
        typeof mainConfigPath !== 'undefined' &&
        !options.force
      ) {
        // TODO: Perhaps offer a --force prompt
        blockResult = await autoblock({
          packageManager,
          configDir,
          // TODO: rework the autoblock to account for multi-package.json
          packageJson: packageManager.primaryPackageJson.packageJson,
          mainConfig,
          mainConfigPath,
        });
      }

      return {
        configDir,
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
        blockers: blockResult,
      };
    } catch (err) {
      return {
        configDir: _configDir,
        error: err,
      };
    }
  });

  return Promise.all(upgradeData);
};

export const getInstalledStorybookVersion = async (packageManager: JsPackageManager) => {
  const storybookCliVersion = await packageManager.getInstalledVersion('storybook');
  if (storybookCliVersion) {
    return storybookCliVersion;
  }

  const installations = await packageManager.findInstallations(Object.keys(versions));
  if (!installations) {
    return;
  }

  return Object.entries(installations.dependencies)[0]?.[1]?.[0].version;
};

function getVersionModifier(versionSpecifier: string) {
  if (!versionSpecifier || typeof versionSpecifier !== 'string') {
    return '';
  }

  // Split in case of complex version strings like "9.0.0 || >= 0.0.0-pr.0"
  const firstPart = versionSpecifier.split(/\s*\|\|\s*/)[0].trim();

  // Match common modifiers
  const match = firstPart.match(/^([~^><=]+)/);

  return match ? match[1] : '';
}

/** Based on a list of dependencies, return a which need upgrades and to which versions */
const toUpgradedDependencies = async (
  deps: Record<string, string> = {},
  packageManager: JsPackageManager,
  {
    isCanary = false,
    isCLIOutdated = false,
    isCLIPrerelease = false,
    isCLIExactPrerelease = false,
    isCLIExactLatest = false,
  } = {}
): Promise<string[]> => {
  const monorepoDependencies = Object.keys(deps || {}).filter((dependency) => {
    // only upgrade packages that are in the monorepo
    return dependency in versions;
  }) as Array<keyof typeof versions>;

  const storybookCoreUpgrades = monorepoDependencies.map((dependency) => {
    /**
     * Respect the modifier that the user set to the dependency, but make it fixed when the CLI is
     * outdated (e.g. user is downgrading) or when upgrading to a canary version.
     *
     * Example outputs:
     *
     * - @storybook/react@9.0.0
     * - @storybook/react@^9.0.0
     * - @storybook/react@~9.0.0
     */
    let char = getVersionModifier(deps[dependency]);

    if (isCLIOutdated) {
      char = '';
    }
    if (isCanary) {
      char = '';
    }

    return `${dependency}@${char}${versions[dependency]}`;
  });

  let storybookSatelliteUpgrades: string[] = [];
  if (isCLIExactPrerelease || isCLIExactLatest) {
    const satelliteDependencies = Object.keys(deps).filter(isSatelliteAddon);

    if (satelliteDependencies.length > 0) {
      try {
        storybookSatelliteUpgrades = (
          await Promise.all(
            satelliteDependencies.map(async (dependency) => {
              try {
                const mostRecentVersion = await packageManager.latestVersion(
                  isCLIPrerelease ? `${dependency}@next` : dependency
                );
                const modifier = getVersionModifier(deps[dependency]);
                return `${dependency}@${modifier}${mostRecentVersion}`;
              } catch (err) {
                return null;
              }
            })
          )
        ).filter(Boolean) as string[];
      } catch (error) {
        // If there is an error fetching satellite dependencies, we don't want to block the upgrade
      }
    }
  }

  return [...storybookCoreUpgrades, ...storybookSatelliteUpgrades];
};

export async function upgradeStorybookDependencies({
  packageManager,
  isCanary,
  isCLIOutdated,
  isCLIPrerelease,
  isCLIExactPrerelease,
  isCLIExactLatest,
}: {
  packageManager: JsPackageManager;
  isCanary: boolean;
  isCLIOutdated: boolean;
  isCLIPrerelease: boolean;
  isCLIExactPrerelease: boolean;
  isCLIExactLatest: boolean;
}) {
  const packageJson = packageManager.primaryPackageJson.packageJson;
  const upgradedDependencies = await toUpgradedDependencies(
    packageJson.dependencies as Record<string, string>,
    packageManager,
    {
      isCanary,
      isCLIOutdated,
      isCLIPrerelease,
      isCLIExactPrerelease,
      isCLIExactLatest,
    }
  );

  const upgradedDevDependencies = await toUpgradedDependencies(
    packageJson.devDependencies as Record<string, string>,
    packageManager,
    {
      isCanary,
      isCLIOutdated,
      isCLIPrerelease,
      isCLIExactPrerelease,
      isCLIExactLatest,
    }
  );

  // Update all dependencies
  logger.info(`Updating dependencies in ${picocolors.cyan('package.json')}..`);
  const addDeps = async (deps: string[], isDev: boolean) => {
    if (deps.length > 0) {
      await packageManager.addDependencies(
        { installAsDevDependencies: isDev, skipInstall: true },
        deps
      );
    }
  };

  await addDeps(upgradedDependencies, false);
  await addDeps(upgradedDevDependencies, true);
  await packageManager.installDependencies();
}

export async function getProjects(
  options: UpgradeOptions
): Promise<CollectProjectsSuccessResult[] | undefined> {
  const gitRoot = getProjectRoot();

  let detectedConfigDirs: string[] = options.configDir ?? [];
  if (options.configDir === undefined || options.configDir.length === 0) {
    detectedConfigDirs = await findStorybookProjects();
  }

  const projects = await collectProjects(options, detectedConfigDirs.slice(0, 4));

  const validProjects = projects.filter(isSuccessResult);
  const errorProjects = projects.filter(isErrorResult);

  if (validProjects.length === 1) {
    return validProjects;
  }

  if (validProjects.length === 0 && errorProjects.length > 0) {
    logger.plain(
      `❌ Storybook found errors while collecting data for the following projects:\n${errorProjects
        .map((p) => {
          const error = p.error;
          return `${picocolors.cyan(p.configDir.replace(gitRoot, ''))}:\n${error.message}`;
        })
        .join('\n')}`
    );
    logger.plain('Please fix the errors and run the upgrade command again.');
    return [];
  }

  const allPackageJsonPathsWithStorybookDependencies = validProjects
    .flatMap((data) => data.packageManager.packageJsonPaths)
    .filter(JsPackageManager.hasAnyStorybookDependency);
  const uniquePackageJsonPathsWithStorybookDependencies = new Set(
    allPackageJsonPathsWithStorybookDependencies
  );

  const hasOverlappingStorybooks =
    uniquePackageJsonPathsWithStorybookDependencies.size !==
    allPackageJsonPathsWithStorybookDependencies.length;

  if (hasOverlappingStorybooks) {
    const getConfigDirsMessage = (projectData: CollectProjectsResult[], modifier: string = '✔') =>
      projectData.length > 0
        ? `${projectData
            .map((p) => p.configDir)
            .map((dir) => `${modifier} ` + picocolors.cyan(dir.replace(gitRoot, '')))
            .join('\n')}`
        : '';

    const invalidProjectsMessage =
      errorProjects.length > 0
        ? `\nThere were some errors while collecting data for the following projects:\n${getConfigDirsMessage(errorProjects, '✕')}`
        : '';

    logger.plain(
      `Multiple Storybook projects found. Storybook can only upgrade all projects at once:\n${getConfigDirsMessage(validProjects)}${invalidProjectsMessage}`
    );
    const continueUpgrade = await prompt.confirm({
      message: `Continue with the upgrade?`,
      initialValue: true,
    });

    if (!continueUpgrade) {
      process.exit(0);
    }

    return validProjects;
  } else if (detectedConfigDirs.length > 1) {
    const selectedConfigDirs = await prompt.multiselect({
      message: 'Select which projects to upgrade',
      options: detectedConfigDirs.map((configDir) => ({
        label: configDir.replace(gitRoot, ''),
        value: configDir,
      })),
    });

    return validProjects.filter((data) => selectedConfigDirs.includes(data.configDir));
  }
}
