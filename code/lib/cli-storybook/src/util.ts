import type { JsPackageManager } from 'storybook/internal/common';
import { prompt, versions } from 'storybook/internal/common';
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
import type { UpgradeOptions } from './upgrade';

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
