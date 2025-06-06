import type { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, type TaskLogInstance, logger, prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { UpgradeOptions } from '../upgrade';
import { shortenPath } from '../util';
import type { CollectProjectsSuccessResult } from '../util';
import { allFixes } from './fixes';
import { rnstorybookConfig } from './fixes/rnstorybook-config';
import type { CheckOptions, Fix, FixId, RunOptions } from './types';
import { FixStatus } from './types';

export interface ProjectAutomigrationData {
  configDir: string;
  packageManager: JsPackageManager;
  mainConfig: StorybookConfigRaw;
  mainConfigPath: string;
  previewConfigPath?: string;
  storybookVersion: string;
  beforeVersion: string;
  storiesPaths: string[];
}

export interface AutomigrationCheckResultReport {
  result: any;
  status: 'success' | 'failed';
  project: ProjectAutomigrationData;
}

export interface AutomigrationCheckResult<T = any> {
  fix: Fix<T>;
  reports: AutomigrationCheckResultReport[];
}

export interface MultiProjectAutomigrationOptions {
  fixes: Fix[];
  projects: ProjectAutomigrationData[];
  dryRun?: boolean;
  yes?: boolean;
  skipInstall?: boolean;
  taskLog: TaskLogInstance;
}

/** Collects all applicable automigrations across multiple projects */
export async function collectAutomigrationsAcrossProjects(
  options: MultiProjectAutomigrationOptions
): Promise<AutomigrationCheckResult[]> {
  const { fixes, projects, taskLog } = options;
  const automigrationMap = new Map<FixId, AutomigrationCheckResult>();

  const totalStartTime = performance.now();
  const fixTimings = new Map<FixId, { totalTime: number; checkCount: number }>();

  logger.debug(
    `Starting automigration collection across ${projects.length} projects and ${fixes.length} fixes...`
  );

  /** Utility to collect results and account for existing entries in the map. */
  function collectResult(
    fix: Fix,
    project: ProjectAutomigrationData,
    status: 'success' | 'failed',
    result?: any
  ) {
    const existing = automigrationMap.get(fix.id);
    if (existing) {
      // Add project to existing automigration
      existing.reports.push({
        project,
        result,
        status,
      });
    } else {
      // Create new automigration entry
      automigrationMap.set(fix.id, {
        fix,
        reports: [
          {
            result,
            status,
            project,
          },
        ],
      });
    }
  }

  // Run check for each fix on each project
  for (const project of projects) {
    const projectStartTime = performance.now();
    const projectName = shortenPath(project.configDir);

    taskLog.message(`Checking automigrations for ${projectName}...`);
    logger.debug(`Processing project: ${projectName}`);

    for (const fix of fixes) {
      const fixStartTime = performance.now();

      try {
        logger.debug(`Checking fix ${fix.id} for project ${projectName}...`);

        const checkOptions: CheckOptions = {
          packageManager: project.packageManager,
          configDir: project.configDir,
          mainConfig: project.mainConfig,
          storybookVersion: project.storybookVersion,
          previewConfigPath: project.previewConfigPath,
          mainConfigPath: project.mainConfigPath,
          storiesPaths: project.storiesPaths,
        };
        const result = await fix.check(checkOptions);

        const fixDuration = performance.now() - fixStartTime;

        // Track fix timing
        const existingTiming = fixTimings.get(fix.id);
        if (existingTiming) {
          existingTiming.totalTime += fixDuration;
          existingTiming.checkCount += 1;
        } else {
          fixTimings.set(fix.id, { totalTime: fixDuration, checkCount: 1 });
        }

        logger.debug(
          `Fix ${fix.id} completed in ${fixDuration.toFixed(2)}ms for project ${projectName}`
        );

        if (result !== null) {
          collectResult(fix, project, 'success', result);
        }
      } catch (error) {
        collectResult(fix, project, 'failed');
        const fixDuration = performance.now() - fixStartTime;
        logger.debug(
          `Fix ${fix.id} failed in ${fixDuration.toFixed(2)}ms for project ${projectName}`
        );

        // Still track timing for failed checks
        const existingTiming = fixTimings.get(fix.id);
        if (existingTiming) {
          existingTiming.totalTime += fixDuration;
          existingTiming.checkCount += 1;
        } else {
          fixTimings.set(fix.id, { totalTime: fixDuration, checkCount: 1 });
        }

        logger.debug(
          `Failed to check fix ${fix.id} for project ${shortenPath(project.configDir)}.`
        );
        logger.debug(`${error instanceof Error ? error.stack : String(error)}`);
      }
    }

    const projectDuration = performance.now() - projectStartTime;
    logger.debug(`Completed processing project ${projectName} in ${projectDuration.toFixed(2)}ms`);
  }

  const totalDuration = performance.now() - totalStartTime;

  // Log summary of fix performance
  logger.debug(`\n=== Automigration Performance Summary ===`);
  logger.debug(`Total collection time: ${totalDuration.toFixed(2)}ms`);
  logger.debug(`Processed ${projects.length} projects with ${fixes.length} fixes each`);

  // Sort fixes by average execution time
  const sortedFixTimings = Array.from(fixTimings.entries())
    .map(([fixId, timing]) => ({
      fixId,
      totalTime: timing.totalTime,
      averageTime: timing.totalTime / timing.checkCount,
      checkCount: timing.checkCount,
    }))
    .sort((a, b) => b.averageTime - a.averageTime);

  logger.debug(`\nFix performance (sorted by average time):`);
  for (const { fixId, totalTime, averageTime, checkCount } of sortedFixTimings) {
    logger.debug(
      `  ${fixId}: avg ${averageTime.toFixed(2)}ms, total ${totalTime.toFixed(2)}ms (${checkCount} checks)`
    );
  }

  if (sortedFixTimings.length > 0) {
    const slowestFix = sortedFixTimings[0];
    const fastestFix = sortedFixTimings[sortedFixTimings.length - 1];
    logger.debug(`\nSlowest fix: ${slowestFix.fixId} (${slowestFix.averageTime.toFixed(2)}ms avg)`);
    logger.debug(`Fastest fix: ${fastestFix.fixId} (${fastestFix.averageTime.toFixed(2)}ms avg)`);
  }

  const detectedAutomigrations = Array.from(automigrationMap.values());

  // Single pass through detectedAutomigrations to build both arrays
  const { successAutomigrations, failedAutomigrations } = detectedAutomigrations.reduce(
    (acc, { fix, reports }) => {
      const successReports = reports.filter((report) => report.status === 'success');
      const failedReports = reports.filter((report) => report.status === 'failed');

      if (successReports.length > 0) {
        acc.successAutomigrations.push(fix.id);
      }

      if (failedReports.length > 0) {
        acc.failedAutomigrations.push(fix.id);
      }

      return acc;
    },
    { successAutomigrations: [], failedAutomigrations: [] } as {
      successAutomigrations: Array<string>;
      failedAutomigrations: Array<string>;
    }
  );

  taskLog.message('\nAutomigrations detected:');

  successAutomigrations.forEach((fixId) => {
    taskLog.message(`${CLI_COLORS.success(`${logger.SYMBOLS.success} ${fixId}`)}`);
  });

  failedAutomigrations.forEach((fixId) => {
    taskLog.message(`${CLI_COLORS.error(`${logger.SYMBOLS.error} ${fixId}`)}`);
  });

  if (failedAutomigrations.length > 0) {
    taskLog.error(
      `${failedAutomigrations.length} automigration ${
        failedAutomigrations.length > 1 ? 'checks' : 'check'
      } failed`
    );
  } else {
    taskLog.success(
      `${detectedAutomigrations.length === 0 ? 'No automigrations detected' : `${detectedAutomigrations.length} automigrations detected`}`
    );
  }

  // only return automigrations that have not failed for all projects
  return detectedAutomigrations.filter((automigration) => {
    return automigration.reports.some((report) => report.status === 'success');
  });
}

/** Prompts user to select which automigrations to run */
export async function promptForAutomigrations(
  automigrations: AutomigrationCheckResult[],
  options: { dryRun?: boolean; yes?: boolean }
): Promise<AutomigrationCheckResult[]> {
  if (automigrations.length === 0) {
    return [];
  }

  // Format project directories relative to git root
  const formatProjectDirs = (list: AutomigrationCheckResult['reports']) => {
    const amountOfProjectsShown = 1;
    const relativeDirs = list.map((p) => shortenPath(p.project.configDir) || '.');
    if (relativeDirs.length <= amountOfProjectsShown) {
      return relativeDirs.join(', ');
    }
    const remaining = relativeDirs.length - amountOfProjectsShown;
    return `${relativeDirs.slice(0, amountOfProjectsShown).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
  };

  if (options.dryRun) {
    logger.log('\n📋 Detected automigrations (dry run - no changes will be made):');
    automigrations.forEach(({ fix, reports: list }) => {
      logger.log(`  - ${fix.id} (${formatProjectDirs(list)})`);
    });
    return [];
  }

  if (options.yes) {
    logger.log('\n✅ Running all detected automigrations:');
    automigrations.forEach(({ fix, reports: list }) => {
      logger.log(`  - ${fix.id} (${formatProjectDirs(list)})`);
    });
    return automigrations;
  }

  // Create choices for multiselect prompt
  const choices = automigrations.map((am) => {
    const hint = [];

    hint.push(`${am.fix.prompt()}`);

    if (am.fix.link) {
      hint.push(`More info: ${am.fix.link}`);
    }

    const label =
      am.reports.length > 1 ? `${am.fix.id} (${formatProjectDirs(am.reports)})` : am.fix.id;

    return {
      value: am.fix.id,
      label,
      hint: hint.join('\n'),
    };
  });

  const selectedIds = await prompt.multiselect({
    message: 'Select automigrations to run',
    options: choices,
    initialValues: choices.map((c) => c.value),
  });

  return automigrations.filter((am) => selectedIds.includes(am.fix.id));
}

/** Runs selected automigrations for each project */
export async function runAutomigrationsForProjects(
  selectedAutomigrations: AutomigrationCheckResult[],
  options: Omit<MultiProjectAutomigrationOptions, 'taskLog'>
): Promise<Record<string, Record<FixId, FixStatus>>> {
  const { dryRun, skipInstall } = options;
  const projectResults: Record<string, Record<FixId, FixStatus>> = {};

  // Group automigrations by project
  type ConfigDir = string;
  const projectAutomigrations = new Map<
    ConfigDir,
    {
      fix: Fix;
      project: ProjectAutomigrationData;
      result: any;
    }[]
  >();

  // selectedAutomigrations -> { fix, reports } -> reports (status passed or failed or skipped) -> project
  for (const automigration of selectedAutomigrations) {
    for (const report of automigration.reports) {
      const { project, result } = report;
      const existing = projectAutomigrations.get(project.configDir) || [];

      if (existing.length > 0) {
        existing.push({
          fix: automigration.fix,
          project,
          result,
        });
      } else {
        projectAutomigrations.set(project.configDir, [
          {
            fix: automigration.fix,
            project,
            result,
          },
        ]);
      }
    }
  }

  // Run automigrations for each project
  let projectIndex = 0;
  for (const [configDir, automigrations] of projectAutomigrations) {
    const countPrefix =
      projectAutomigrations.size > 1 ? `(${++projectIndex}/${projectAutomigrations.size}) ` : '';
    const { project } = automigrations[0];

    if (!project) {
      continue;
    }

    const projectName = shortenPath(project.configDir);
    const taskLog = prompt.taskLog({
      id: `automigrate-${projectName}`,
      title: `${countPrefix}Running automigrations for ${projectName}:`,
    });
    const fixResults: Record<FixId, FixStatus> = {};

    for (const automigration of automigrations) {
      const { fix } = automigration;
      const { result } = automigration;

      try {
        if (typeof fix.run === 'function') {
          const runOptions: RunOptions<typeof result> = {
            packageManager: project.packageManager,
            result,
            dryRun,
            mainConfigPath: project.mainConfigPath,
            previewConfigPath: project.previewConfigPath,
            mainConfig: project.mainConfig,
            configDir: project.configDir,
            skipInstall,
            storybookVersion: project.storybookVersion,
            storiesPaths: project.storiesPaths,
          };

          await fix.run(runOptions);
          fixResults[fix.id] = FixStatus.SUCCEEDED;
          taskLog.message(CLI_COLORS.success(`${logger.SYMBOLS.success} ${fix.id}`));
        }
      } catch (error) {
        fixResults[fix.id] = FixStatus.FAILED;
        taskLog.message(CLI_COLORS.error(`${logger.SYMBOLS.error} ${automigration.fix.id}`));
        logger.debug(`${error instanceof Error ? error.stack : String(error)}`);
      }
    }

    const automigrationsWithErrors = Object.values(fixResults).filter(
      (status) => status === FixStatus.FAILED
    );

    if (automigrationsWithErrors.length > 0) {
      const count = automigrationsWithErrors.length;
      taskLog.error(`${countPrefix}${count} automigrations failed for ${projectName}`);
    } else {
      taskLog.success(`${countPrefix}Completed automigrations for ${projectName}`);
    }

    projectResults[configDir] = fixResults;
  }

  return projectResults;
}

export async function runAutomigrations(
  projects: CollectProjectsSuccessResult[],
  options: UpgradeOptions
) {
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

  const detectingAutomigrationTask = prompt.taskLog({
    id: 'detect-automigrations',
    title:
      projectAutomigrationData.length > 1
        ? `Detecting automigrations for ${projectAutomigrationData.length} projects...`
        : `Detecting automigrations...`,
  });
  // Collect all applicable automigrations across all projects
  const detectedAutomigrations = await collectAutomigrationsAcrossProjects({
    fixes: allFixes,
    projects: projectAutomigrationData,
    dryRun: options.dryRun,
    yes: options.yes,
    skipInstall: options.skipInstall,
    taskLog: detectingAutomigrationTask,
  });

  // Prompt user to select which automigrations to run
  const selectedAutomigrations = await promptForAutomigrations(detectedAutomigrations, {
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

  // Special case handling for rnstorybook-config which renames the config dir
  Object.entries(projectResults).forEach(([configDir, fixResults]) => {
    if (fixResults[rnstorybookConfig.id] === FixStatus.SUCCEEDED) {
      const project = projects.find((p) => p.configDir === configDir);
      if (project) {
        project.configDir = project.configDir.replace('.storybook', '.rnstorybook');
      }
    }
  });

  return projectResults;
}
