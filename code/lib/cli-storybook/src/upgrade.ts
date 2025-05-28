import type { PackageManagerName } from 'storybook/internal/common';
import {
  JsPackageManagerFactory,
  getProjectRoot,
  isCorePackage,
  prompt,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import { sync as spawnSync } from 'cross-spawn';
import picocolors from 'picocolors';
import semver, { clean, lt } from 'semver';
import { dedent } from 'ts-dedent';

import { allFixes } from './automigrate/fixes';
import {
  type ProjectAutomigrationData,
  collectAutomigrationsAcrossProjects,
  promptForAutomigrations,
  runAutomigrationsForProjects,
} from './automigrate/multi-project';
import { doctor } from './doctor';
import { getProjects, upgradeStorybookDependencies } from './util';

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

export type UpgradeOptions = {
  skipCheck: boolean;
  packageManager?: PackageManagerName;
  dryRun: boolean;
  yes: boolean;
  force: boolean;
  disableTelemetry: boolean;
  configDir?: string[];
  fixId?: string;
  skipInstall?: boolean;
};

export async function upgrade(options: UpgradeOptions): Promise<void> {
  const gitRoot = getProjectRoot();
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
      const relativeDirs = configDirs.map((dir) => dir.replace(gitRoot, '') || '.');
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

  // Update dependencies for all projects
  if (!options.dryRun) {
    for (const project of projects) {
      await upgradeStorybookDependencies({
        packageManager: project.packageManager,
        isCanary: project.isCanary,
        isCLIOutdated: project.isCLIOutdated,
        isCLIPrerelease: project.isCLIPrerelease,
        isCLIExactLatest: project.isCLIExactLatest,
        isCLIExactPrerelease: project.isCLIExactPrerelease,
      });
    }
  }

  // AUTOMIGRATIONS - New multi-project flow
  if (!options.skipCheck) {
    checkVersionConsistency();

    // Prepare project data for automigrations
    const projectAutomigrationData: ProjectAutomigrationData[] = projects.map((project) => ({
      configDir: project.configDir,
      packageManager: project.packageManager,
      mainConfig: project.mainConfig,
      mainConfigPath: project.mainConfigPath!,
      previewConfigPath: project.previewConfigPath,
      storybookVersion: project.currentCLIVersion,
      beforeVersion: project.beforeVersion,
      storiesPaths: project.storiesPaths,
    }));

    // Collect all applicable automigrations across all projects
    const detectedAutomigrations = await collectAutomigrationsAcrossProjects({
      fixes: allFixes,
      projects: projectAutomigrationData,
      dryRun: options.dryRun,
      yes: options.yes,
      skipInstall: options.skipInstall,
      isUpgrade: true,
    });

    // Prompt user to select which automigrations to run
    const selectedAutomigrations = await promptForAutomigrations(detectedAutomigrations, gitRoot, {
      dryRun: options.dryRun,
      yes: options.yes,
    });

    // Run selected automigrations for each project
    const projectResults = await runAutomigrationsForProjects(selectedAutomigrations, {
      fixes: allFixes,
      projects: projectAutomigrationData,
      dryRun: options.dryRun,
      yes: options.yes,
      skipInstall: options.skipInstall,
    });

    // Run doctor for each project
    for (const project of projects) {
      await doctor({ ...options, configDir: project.configDir });
    }

    // TELEMETRY
    if (!options.disableTelemetry) {
      for (const project of projects) {
        const fixResults = projectResults[project.configDir] || {};
        await telemetry('upgrade', {
          beforeVersion: project.beforeVersion,
          afterVersion: project.currentCLIVersion,
          automigrationResults: fixResults,
          automigrationPreCheckFailure: null,
        });
      }
    }
  }

  const rootPackageManager =
    projects.length > 1
      ? JsPackageManagerFactory.getPackageManager({
          force: options.packageManager,
        })
      : projects[0].packageManager;

  await rootPackageManager.installDependencies();
  await rootPackageManager
    .executeCommand({ command: 'dedupe', args: [], stdio: 'ignore' })
    .catch(() => {});

  logger.plain(`\n${picocolors.green('Your project(s) have been upgraded successfully! 🎉')}`);
  // TODO: if multiple projects, multi-upgrade telemetry with e.g.
  // { success: X, fail: Y, incomplete: Z }
}
