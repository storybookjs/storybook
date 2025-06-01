import type { PackageManagerName } from 'storybook/internal/common';
import { JsPackageManagerFactory, isCorePackage } from 'storybook/internal/common';
import { logTracker, prompt } from 'storybook/internal/node-logger';
import {
  UpgradeStorybookToLowerVersionError,
  UpgradeStorybookUnknownCurrentVersionError,
} from 'storybook/internal/server-errors';
import { telemetry } from 'storybook/internal/telemetry';

import { sync as spawnSync } from 'cross-spawn';
import picocolors from 'picocolors';
import semver, { clean, lt } from 'semver';
import { dedent } from 'ts-dedent';

import { processAutoblockerResults } from './autoblock/utils';
import { runAutomigrations } from './automigrate/multi-project';
import type { FixId } from './automigrate/types';
import { FixStatus } from './automigrate/types';
import { displayDoctorResults, runMultiProjectDoctor } from './doctor';
import type { ProjectDoctorData, ProjectDoctorResults } from './doctor/types';
import { getProjects, shortenPath, upgradeStorybookDependencies } from './util';

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

const warnPackages = (pkgs: Package[]) => pkgs.map((pkg) => `- ${formatPackage(pkg)}`).join('\n');

export const checkVersionConsistency = () => {
  const lines = spawnSync('npm', ['ls'], { stdio: 'pipe', shell: true })
    .output.toString()
    .split('\n');
  const storybookPackages = lines
    .map(getStorybookVersion)
    .filter((item): item is NonNullable<typeof item> => !!item)
    .filter((pkg) => isCorePackage(pkg.package));
  if (!storybookPackages.length) {
    prompt.warn('No storybook core packages found.');
    prompt.warn(`'npm ls | grep storybook' can show if multiple versions are installed.`);
    return;
  }
  storybookPackages.sort((a, b) => semver.rcompare(a.version, b.version));
  const latestVersion = storybookPackages[0].version;
  const outdated = storybookPackages.filter((pkg) => pkg.version !== latestVersion);
  if (outdated.length > 0) {
    prompt.warn(
      dedent`Found ${outdated.length} outdated packages (relative to '${formatPackage(
        storybookPackages[0]
      )}')
      Please make sure your packages are updated to ensure a consistent experience:

      ${warnPackages(outdated)}`
    );
  }

  deprecatedPackages.forEach(({ minVersion, url, deprecations }) => {
    if (semver.gte(latestVersion, minVersion)) {
      const deprecated = storybookPackages.filter((pkg) => deprecations.includes(pkg.package));
      if (deprecated.length > 0) {
        prompt.warn(
          dedent`Found ${deprecated.length} deprecated packages since ${minVersion}
          See ${url}
          ${warnPackages(deprecated)}`
        );
      }
    }
  });
  prompt.debug('End of version consistency check');
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

/** Logs the results of the upgrade process, including project categorization and diagnostic messages */
function logUpgradeResults(
  projectResults: Record<string, Record<FixId, FixStatus>>,
  doctorResults: Record<string, ProjectDoctorResults>
) {
  // Display upgrade results summary
  const successfulProjects: string[] = [];
  const failedProjects: string[] = [];
  const projectsWithNoFixes: string[] = [];

  Object.entries(projectResults).forEach(([configDir, fixResults]) => {
    const hasFailures = Object.values(fixResults).some(
      (status) => status === FixStatus.FAILED || status === FixStatus.CHECK_FAILED
    );
    const hasSuccessfulFixes = Object.values(fixResults).some(
      (status) => status === FixStatus.SUCCEEDED || status === FixStatus.MANUAL_SUCCEEDED
    );

    if (hasFailures) {
      failedProjects.push(configDir);
    } else if (hasSuccessfulFixes) {
      successfulProjects.push(configDir);
    } else if (Object.keys(fixResults).length === 0) {
      projectsWithNoFixes.push(configDir);
    }
  });

  // If there are any failures, show detailed summary
  if (failedProjects.length > 0) {
    // Display appropriate messages based on results
    if (successfulProjects.length > 0) {
      const projectList = successfulProjects
        .map((dir) => picocolors.cyan(shortenPath(dir)))
        .join(', ');
      prompt.log(`\n${picocolors.green('✅ Successfully upgraded:')} ${projectList}`);
    }

    const projectList = failedProjects.map((dir) => picocolors.cyan(shortenPath(dir))).join(', ');
    prompt.log(`\n${picocolors.red('❌ Failed to upgrade:')} ${projectList}`);

    if (projectsWithNoFixes.length > 0) {
      const projectList = projectsWithNoFixes
        .map((dir) => picocolors.cyan(shortenPath(dir)))
        .join(', ');
      prompt.log(`\n${picocolors.yellow('ℹ️  No changes needed:')} ${projectList}`);
    }
  } else {
    if (Object.values(doctorResults).every((result) => result.status === 'healthy')) {
      prompt.log(`\n${picocolors.green('Your project(s) have been upgraded successfully! 🎉')}`);
    } else {
      prompt.log(
        `\n${picocolors.yellow('Your project(s) have been upgraded successfully, but some issues were found which need your attention, please check Storybook doctor logs above.')}`
      );
    }
  }
}

export async function upgrade(options: UpgradeOptions): Promise<void> {
  prompt.intro('Storybook Upgrade');
  // TODO: telemetry for upgrade start
  const projects = await getProjects(options);
  if (projects === undefined || projects.length === 0) {
    // nothing to upgrade
    return;
  }

  // Handle autoblockers
  const hasBlockers = processAutoblockerResults(projects, (message) => {
    prompt.error(dedent`${message}`);
  });

  if (hasBlockers) {
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

  // Update dependencies in package.jsons for all projects
  if (!options.dryRun) {
    const task = prompt.taskLog({
      title: `Fetching versions to update package.json files..`,
    });
    try {
      const loggedPaths: string[] = [];
      for (const project of projects) {
        prompt.debug(
          `Updating dependencies in ${picocolors.cyan(shortenPath(project.configDir))}...`
        );
        const packageJsonPaths = project.packageManager.packageJsonPaths.map(shortenPath);
        const newPaths = packageJsonPaths.filter((path) => !loggedPaths.includes(path));
        if (newPaths.length > 0) {
          task.message(newPaths.join('\n'));
          loggedPaths.push(...newPaths);
        }
        await upgradeStorybookDependencies({
          packageManager: project.packageManager,
          isCanary: project.isCanary,
          isCLIOutdated: project.isCLIOutdated,
          isCLIPrerelease: project.isCLIPrerelease,
          isCLIExactLatest: project.isCLIExactLatest,
          isCLIExactPrerelease: project.isCLIExactPrerelease,
        });
      }
      task.success(`Updated package versions in package.json files`);
    } catch (err) {
      task.error(`Failed to upgrade dependencies: ${String(err)}`);
    }
  }

  // AUTOMIGRATIONS - New multi-project flow

  // Run automigrations for all projects
  const projectResults = await runAutomigrations(projects, options);

  // Install dependencies
  const rootPackageManager =
    projects.length > 1
      ? JsPackageManagerFactory.getPackageManager({ force: options.packageManager })
      : projects[0].packageManager;

  await rootPackageManager.installDependencies();

  // Run doctor for each project
  const doctorProjects: ProjectDoctorData[] = projects.map((project) => ({
    configDir: project.configDir,
    packageManager: project.packageManager,
    storybookVersion: project.currentCLIVersion,
    mainConfig: project.mainConfig,
  }));

  prompt.step('🩺 Checking the health of your project(s)..');
  // TODO: Pass doctorResults to multi-upgrade telemetry
  const doctorResults = await runMultiProjectDoctor(doctorProjects);
  const hasIssues = displayDoctorResults(doctorResults);
  if (hasIssues) {
    logTracker.enableLogWriting();
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
        // TODO: Discuss with Valentin
        doctorResults: doctorResults[project.configDir]?.diagnostics || {},
      });
    }
  }

  // Display upgrade results summary
  logUpgradeResults(projectResults, doctorResults);

  // TODO: if multiple projects, multi-upgrade telemetry with e.g.
  // { success: X, fail: Y, incomplete: Z }
}
