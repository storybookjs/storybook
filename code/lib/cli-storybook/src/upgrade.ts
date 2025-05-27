import type { PackageManagerName } from 'storybook/internal/common';
import { getProjectRoot, isCorePackage } from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { logger, prompt } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import { sync as spawnSync } from 'cross-spawn';
import picocolors from 'picocolors';
import semver, { clean, lt } from 'semver';
import { dedent } from 'ts-dedent';

import { automigrate } from './automigrate/index';
import { doctor } from './doctor';
import {
  type CollectProjectsSuccessResult,
  getProjects,
  shortenPath,
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
  cliOptions: InternalUpgradeOptions,
  {
    isCLIOutdated,
    isCLIPrerelease,
    isCLIExactLatest,
    isUpgrade,
    beforeVersion,
    currentCLIVersion,
    isCanary,
    isCLIExactPrerelease,
    configDir,
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    packageManager,
  }: CollectProjectsSuccessResult
) => {
  const { skipCheck, dryRun, yes } = cliOptions;

  let results;

  const { packageJson } = packageManager.primaryPackageJson;

  // INSTALL UPDATED DEPENDENCIES
  if (!dryRun && !results) {
    await upgradeStorybookDependencies({
      packageManager,
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
  if (!cliOptions.disableTelemetry) {
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

  await doctor(cliOptions);
};

export type UpgradeOptions = Omit<InternalUpgradeOptions, 'configDir'> & { configDir?: string[] };

export async function upgrade(options: UpgradeOptions): Promise<void> {
  prompt.intro('Storybook Upgrade');
  // TODO: telemetry for upgrade start
  const projects = await getProjects(options);
  if (projects === undefined || projects.length === 0) {
    // nothing to upgrade
    return;
  }

  // Handle autoblockers
  const autoblockerMessagesMap = new Map<
    string,
    { message: string; link?: string; configDirs: string[] }
  >();

  projects.forEach((result) => {
    result.autoblockerCheckResults?.forEach((blocker) => {
      if (blocker.result === null || blocker.result === false) {
        return;
      }
      const blockerMessage = blocker.blocker.log(blocker.result);
      const message = Array.isArray(blockerMessage) ? blockerMessage.join('\n') : blockerMessage;
      const link = blocker.blocker.link;

      if (autoblockerMessagesMap.has(message)) {
        autoblockerMessagesMap.get(message)!.configDirs.push(result.configDir);
      } else {
        autoblockerMessagesMap.set(message, {
          message,
          link,
          configDirs: [result.configDir],
        });
      }
    });
  });

  const autoblockerMessages = Array.from(autoblockerMessagesMap.values());

  if (autoblockerMessages.length > 0) {
    const formatConfigDirs = (configDirs: string[]) => {
      const relativeDirs = configDirs.map((dir) => shortenPath(dir) || '.');
      if (relativeDirs.length <= 3) {
        return relativeDirs.join(', ');
      }
      const remaining = relativeDirs.length - 3;
      return `${relativeDirs.slice(0, 3).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
    };

    const formattedMessages = autoblockerMessages.map((item) => {
      const configDirInfo = `(${formatConfigDirs(item.configDirs)})`;
      return `${item.message} ${configDirInfo}`;
    });

    prompt.error(dedent`
      Storybook has found potential blockers that need to be resolved before upgrading:
      ${formattedMessages.join('\n')}
    `);
    process.exit(1);
  }

  // Checks whether we can upgrade
  projects.some((project) => {
    if (!project.isCanary && lt(project.currentCLIVersion, project.beforeVersion)) {
      throw new UpgradeStorybookToLowerVersionError({
        beforeVersion: project.beforeVersion,
        currentVersion: project.currentCLIVersion,
      });
    }

    if (!project.beforeVersion) {
      throw new UpgradeStorybookUnknownCurrentVersionError();
    }
  });

  if (projects.length === 1) {
    await withTelemetry(
      'upgrade',
      { cliOptions: { ...options, configDir: projects[0].configDir } },
      async () => doUpgrade({ ...options, configDir: projects[0].configDir }, projects[0])
    );
    return;
  }

  const upgradeStatus: {
    projectName: string;
    status: 'incomplete' | 'complete' | 'failed';
    error?: any;
  }[] = projects.map((data) => {
    const projectName = shortenPath(data.configDir);
    return {
      projectName,
      status: 'incomplete',
      error: null,
    };
  });

  // Migrate each selected project
  for (let i = 0; i < projects.length; i++) {
    const storybookProject = projects[i].configDir;
    const projectName = shortenPath(storybookProject);

    logger.plain(
      `\nUpgrading project ${i + 1}/${projects.length}:\n\t${picocolors.cyan(projectName)}`
    );

    try {
      await withTelemetry(
        'upgrade',
        { cliOptions: { ...options, configDir: storybookProject } },
        async () => doUpgrade({ ...options, configDir: storybookProject }, projects[i])
      );
      upgradeStatus[i].status = 'complete';
    } catch (error) {
      logger.error(`Error upgrading project ${projectName}. Skipping...`);
      upgradeStatus[i].status = 'failed';
      upgradeStatus[i].error = error;
    }
  }

  await projects[0]?.packageManager.installDependencies();

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
