import { readFileSync } from 'node:fs';

import { hasStorybookDependencies } from 'storybook/internal/cli';
import type { PackageJsonWithDepsAndDevDeps, PackageManagerName } from 'storybook/internal/common';
import { JsPackageManager } from 'storybook/internal/common';
import {
  JsPackageManagerFactory,
  getProjectRoot,
  isCorePackage,
  isSatelliteAddon,
  prompt,
  versions,
} from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookInWrongWorkingDirectory,
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookToSameVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import { sync as spawnSync } from 'cross-spawn';
import picocolors from 'picocolors';
import prompts from 'prompts';
import semver, { clean, eq, lt, prerelease } from 'semver';
import { dedent } from 'ts-dedent';

import { autoblock } from './autoblock/index';
import { getStorybookData } from './automigrate/helpers/mainConfigFile';
import { automigrate } from './automigrate/index';
import { doctor } from './doctor';
import {
  type CollectProjectsResult,
  type CollectProjectsSuccessResult,
  collectProjects,
  findStorybookProjects,
  getProjects,
  isErrorResult,
  isSuccessResult,
  upgradeStorybookDependencies,
} from './util';

type Package = {
  package: string;
  version: string;
};

const versionRegex = /(@storybook\/[^@]+)@(\S+)/;
export const getStorybookVersion = (line: string) => {
  if (line.startsWith('npm ')) {
    return null;
  }
  const match = versionRegex.exec(line);

  if (!match || !clean(match[2])) {
    return null;
  }
  return {
    package: match[1],
    version: match[2],
  };
};

const deprecatedPackages = [
  {
    minVersion: '6.0.0-alpha.0',
    url: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#60-deprecations',
    deprecations: [
      '@storybook/addon-notes',
      '@storybook/addon-info',
      '@storybook/addon-contexts',
      '@storybook/addon-options',
      '@storybook/addon-centered',
    ],
  },
];

const formatPackage = (pkg: Package) => `${pkg.package}@${pkg.version}`;

const warnPackages = (pkgs: Package[]) =>
  pkgs.forEach((pkg) => logger.warn(`- ${formatPackage(pkg)}`));

export const checkVersionConsistency = () => {
  const lines = spawnSync('npm', ['ls'], { stdio: 'pipe', shell: true })
    .output.toString()
    .split('\n');
  const storybookPackages = lines
    .map(getStorybookVersion)
    .filter((item): item is NonNullable<typeof item> => !!item)
    .filter((pkg) => isCorePackage(pkg.package));
  if (!storybookPackages.length) {
    logger.warn('No storybook core packages found.');
    logger.warn(`'npm ls | grep storybook' can show if multiple versions are installed.`);
    return;
  }
  storybookPackages.sort((a, b) => semver.rcompare(a.version, b.version));
  const latestVersion = storybookPackages[0].version;
  const outdated = storybookPackages.filter((pkg) => pkg.version !== latestVersion);
  if (outdated.length > 0) {
    logger.warn(
      `Found ${outdated.length} outdated packages (relative to '${formatPackage(
        storybookPackages[0]
      )}')`
    );
    logger.warn('Please make sure your packages are updated to ensure a consistent experience.');
    warnPackages(outdated);
  }

  deprecatedPackages.forEach(({ minVersion, url, deprecations }) => {
    if (semver.gte(latestVersion, minVersion)) {
      const deprecated = storybookPackages.filter((pkg) => deprecations.includes(pkg.package));
      if (deprecated.length > 0) {
        logger.warn(`Found ${deprecated.length} deprecated packages since ${minVersion}`);
        logger.warn(`See ${url}`);
        warnPackages(deprecated);
      }
    }
  });
};

interface InternalUpgradeOptions {
  skipCheck: boolean;
  packageManager?: PackageManagerName;
  dryRun: boolean;
  yes: boolean;
  force: boolean;
  disableTelemetry: boolean;
  configDir?: string;
}

export const doUpgrade = async (
  allOptions: InternalUpgradeOptions,
  {
    isCLIOutdated,
    isCLIPrerelease,
    isCLIExactLatest,
    isUpgrade,
    beforeVersion,
    currentCLIVersion,
    latestCLIVersionOnNPM,
    isCanary,
    isCLIExactPrerelease,
  }: {
    isCLIOutdated: boolean;
    isCLIPrerelease: boolean;
    isCLIExactLatest: boolean;
    isUpgrade: boolean;
    beforeVersion: string;
    currentCLIVersion: string;
    latestCLIVersionOnNPM: string;
    isCanary: boolean;
    isCLIExactPrerelease: boolean;
  }
) => {
  const {
    skipCheck,
    packageManager: packageManagerName,
    dryRun,
    configDir: userSpecifiedConfigDir,
    yes,
    ...options
  } = allOptions;
  const { configDir, mainConfig, mainConfigPath, previewConfigPath, packageManager } =
    await getStorybookData({
      configDir: userSpecifiedConfigDir,
      packageManagerName,
    });

  const borderColor = isCLIOutdated ? '#FC521F' : '#F1618C';

  const messages = {
    welcome: `Upgrading Storybook from version ${picocolors.bold(
      beforeVersion
    )} to version ${picocolors.bold(currentCLIVersion)}..`,
    notLatest: picocolors.red(dedent`
      This version is behind the latest release, which is: ${picocolors.bold(
        latestCLIVersionOnNPM
      )}!
      You likely ran the upgrade command through a remote command like npx, which can use a locally cached version. To upgrade to the latest version please run:
      ${picocolors.bold(`${packageManager.getRemoteRunCommand('storybook', ['upgrade'], 'latest')}`)}
      
      You may want to CTRL+C to stop, and run with the latest version instead.
    `),
    prerelease: picocolors.yellow('This is a pre-release version.'),
  };

  prompt.logBox(
    [messages.welcome]
      .concat(isCLIOutdated && !isCLIPrerelease ? [messages.notLatest] : [])
      .concat(isCLIPrerelease ? [messages.prerelease] : [])
      .join('\n'),
    { borderStyle: 'round', padding: 1, borderColor }
  );

  let results;

  const { packageJson } = packageManager.primaryPackageJson;

  // INSTALL UPDATED DEPENDENCIES
  if (!dryRun && !results) {
    await upgradeStorybookDependencies({
      packageManager,
      packageJson,
      isCanary,
      isCLIOutdated,
      isCLIPrerelease,
      isCLIExactLatest,
      isCLIExactPrerelease,
    });
  }

  // AUTOMIGRATIONS
  if (!skipCheck && !results && mainConfigPath) {
    checkVersionConsistency();
    results = await automigrate({
      dryRun,
      yes,
      packageManager,
      packageJson,
      mainConfig,
      configDir,
      previewConfigPath,
      mainConfigPath,
      beforeVersion,
      storybookVersion: currentCLIVersion,
      isUpgrade,
      isLatest: isCLIExactLatest,
    });
  }

  // TELEMETRY
  if (!options.disableTelemetry) {
    const { preCheckFailure, fixResults } = results || {};
    const automigrationTelemetry = {
      automigrationResults: preCheckFailure ? null : fixResults,
      automigrationPreCheckFailure: preCheckFailure || null,
    };

    await telemetry('upgrade', {
      beforeVersion,
      afterVersion: currentCLIVersion,
      ...automigrationTelemetry,
    });
  }

  await packageManager.installDependencies();

  await doctor(allOptions);
};

export type UpgradeOptions = Omit<InternalUpgradeOptions, 'configDir'> & { configDir?: string[] };

export async function upgrade(options: UpgradeOptions): Promise<void> {
  const gitRoot = getProjectRoot();
  // TODO: telemetry for upgrade start
  const upgradeData = await getProjects(options);
  if (upgradeData === undefined || upgradeData.length === 0) {
    // nothing to upgrade
    return;
  }

  // Single project upgrade scenario
  if (upgradeData.length === 1) {
    const cliOptions = { ...options, configDir: upgradeData[0].configDir };
    await withTelemetry('upgrade', { cliOptions }, async () =>
      doUpgrade(cliOptions, upgradeData[0])
    );
    return;
  }

  // Multi upgrade scenario
  const upgradeStatus: {
    projectName: string;
    status: 'incomplete' | 'complete' | 'failed';
    error?: any;
  }[] = upgradeData.map((data) => {
    const projectName = data.configDir.replace(gitRoot, '');
    return {
      projectName,
      status: 'incomplete',
      error: null,
    };
  });

  // Migrate each selected project
  for (let i = 0; i < upgradeData.length; i++) {
    const storybookProject = upgradeData[i].configDir;
    const projectName = storybookProject.replace(gitRoot, '');

    logger.plain(
      `\nUpgrading project ${i + 1}/${upgradeData.length}:\n\t${picocolors.cyan(projectName)}`
    );

    try {
      await withTelemetry(
        'upgrade',
        { cliOptions: { ...options, configDir: storybookProject } },
        async () => doUpgrade({ ...options, configDir: storybookProject }, upgradeData[i])
      );
      upgradeStatus[i].status = 'complete';
    } catch (error) {
      logger.error(`Error upgrading project ${projectName}. Skipping...`);
      upgradeStatus[i].status = 'failed';
      upgradeStatus[i].error = error;
    }
  }

  const failedProjects = upgradeStatus.filter((status) => status.status === 'failed');

  if (failedProjects.length > 0) {
    logger.plain('\nUpgrade Summary:');
    const successfulProjects = upgradeStatus.filter((status) => status.status === 'complete');
    if (successfulProjects.length > 0) {
      logger.plain('\nSuccessfully upgraded:');
      successfulProjects.forEach((status) => {
        logger.plain(`  ${picocolors.green('✓')} ${status.projectName}`);
      });
    }

    logger.plain('\nFailed to upgrade:');
    failedProjects.forEach((status) => {
      logger.plain(`  ${picocolors.red('✕')} ${status.projectName}`);
      if (status.error) {
        logger.plain(`    ${picocolors.dim(status.error.message || String(status.error))}`);
      }
    });

    logger.plain(
      `\n${picocolors.red('Some projects failed to upgrade. See error details above.')}`
    );
  } else {
    logger.plain(`\n${picocolors.green('Your project(s) have been upgraded successfully! 🎉')}`);
  }
  // TODO: if multiple projects, multi-upgrade telemetry with e.g.
  // { success: X, fail: Y, incomplete: Z }
}
