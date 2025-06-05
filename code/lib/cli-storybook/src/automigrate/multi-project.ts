import type { JsPackageManager } from 'storybook/internal/common';
import { type TaskLogInstance, logger, prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';

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

export interface AutomigrationCheckResult<T = any> {
  fix: Fix<T>;
  result: T;
  projects: ProjectAutomigrationData[];
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
          const existing = automigrationMap.get(fix.id);
          if (existing) {
            // Add project to existing automigration
            existing.projects.push(project);
          } else {
            // Create new automigration entry
            automigrationMap.set(fix.id, {
              fix,
              result,
              projects: [project],
            });
          }
        }
      } catch (error) {
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

        logger.error(
          `Failed to check fix ${fix.id} for project ${shortenPath(project.configDir)}.`
        );
        logger.log('');
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

  return Array.from(automigrationMap.values());
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
  const formatProjectDirs = (projects: ProjectAutomigrationData[]) => {
    const amountOfProjectsShown = 1;
    const relativeDirs = projects.map((p) => shortenPath(p.configDir) || '.');
    if (relativeDirs.length <= amountOfProjectsShown) {
      return relativeDirs.join(', ');
    }
    const remaining = relativeDirs.length - amountOfProjectsShown;
    return `${relativeDirs.slice(0, amountOfProjectsShown).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
  };

  if (options.dryRun) {
    logger.log('\n📋 Detected automigrations (dry run - no changes will be made):');
    automigrations.forEach(({ fix, projects }) => {
      logger.log(`  - ${fix.id} (${formatProjectDirs(projects)})`);
    });
    return [];
  }

  if (options.yes) {
    logger.log('\n✅ Running all detected automigrations:');
    automigrations.forEach(({ fix, projects }) => {
      logger.log(`  - ${fix.id} (${formatProjectDirs(projects)})`);
    });
    return automigrations;
  }

  // Create choices for multiselect prompt
  const choices = automigrations.map((am) => {
    const hint = [];

    hint.push(`${am.fix.prompt(am.result)}`);

    if (am.fix.link) {
      hint.push(`More info: ${am.fix.link}`);
    }

    const label =
      am.projects.length > 1 ? `${am.fix.id} (${formatProjectDirs(am.projects)})` : am.fix.id;

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
  options: MultiProjectAutomigrationOptions
): Promise<Record<string, Record<FixId, FixStatus>>> {
  const { dryRun, skipInstall } = options;
  const projectResults: Record<string, Record<FixId, FixStatus>> = {};

  // Group automigrations by project
  const projectAutomigrations = new Map<string, AutomigrationCheckResult[]>();

  for (const automigration of selectedAutomigrations) {
    for (const project of automigration.projects) {
      const existing = projectAutomigrations.get(project.configDir) || [];
      existing.push(automigration);
      projectAutomigrations.set(project.configDir, existing);
    }
  }

  // Run automigrations for each project
  let projectIndex = 0;
  for (const [configDir, automigrations] of projectAutomigrations) {
    const countPrefix =
      projectAutomigrations.size > 1 ? `(${++projectIndex}/${projectAutomigrations.size}) ` : '';
    const project = automigrations[0].projects.find((p) => p.configDir === configDir);

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
      const { fix, result } = automigration;

      try {
        // Determine prompt type
        const promptType =
          typeof fix.promptType === 'function'
            ? await fix.promptType(result)
            : (fix.promptType ?? 'auto');

        taskLog.message(`  - ${fix.id}...`);

        if (promptType === 'manual') {
          // For manual migrations, show the prompt and mark as manual
          logger.log(`    ℹ️  Manual migration required:`);
          logger.log(`    ${fix.prompt(result).split('\n').join('\n    ')}`);
          fixResults[fix.id] = FixStatus.MANUAL_SUCCEEDED;
        } else if (promptType === 'notification') {
          // For notifications, just show the message
          logger.log(`    ℹ️  Notification:`);
          logger.log(`    ${fix.prompt(result).split('\n').join('\n    ')}`);
          fixResults[fix.id] = FixStatus.SUCCEEDED;
        } else if (typeof fix.run === 'function') {
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
        }
      } catch (error) {
        fixResults[fix.id] = FixStatus.FAILED;
        taskLog.error(`${logger.SYMBOLS.error} ${automigration.fix.id} failed`);
        logger.debug(`${error instanceof Error ? error.stack : String(error)}`);
      }
    }

    taskLog.success(`${countPrefix}Completed automigrations for ${projectName}`);

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

  detectingAutomigrationTask.success(
    `${detectedAutomigrations.length === 0 ? 'No automigrations detected' : `${detectedAutomigrations.length} automigrations detected`}`
  );

  // Prompt user to select which automigrations to run
  const selectedAutomigrations = await promptForAutomigrations(detectedAutomigrations, {
    dryRun: options.dryRun,
    yes: options.yes,
  });

  const runningAutomigrationsTask = prompt.taskLog({
    id: 'run-automigrations',
    title:
      projectAutomigrationData.length > 1
        ? `Running automigrations for ${projectAutomigrationData.length} projects...`
        : `Running automigrations...`,
  });
  // Run selected automigrations for each project
  const projectResults = await runAutomigrationsForProjects(selectedAutomigrations, {
    fixes: allFixes,
    projects: projectAutomigrationData,
    dryRun: options.dryRun,
    yes: options.yes,
    skipInstall: options.skipInstall,
    taskLog: runningAutomigrationsTask,
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
