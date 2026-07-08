import type { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, type TaskLogInstance, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector, sanitizeError } from 'storybook/internal/telemetry';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { UpgradeOptions } from '../upgrade.ts';
import { shortenPath } from '../util.ts';
import type { CollectProjectsSuccessResult } from '../util.ts';
import { allFixes } from './fixes/index.ts';
import { rnstorybookConfig } from './fixes/rnstorybook-config.ts';
import {
  collectMissedTransformationPatterns,
  detectMissedTransformations,
} from './helpers/missedTransformations.ts';
import type {
  CheckOptions,
  Fix,
  FixId,
  MissedTransformationMatch,
  MissedTransformationPattern,
  RunOptions,
} from './types.ts';
import { FixStatus } from './types.ts';
import { RN_STORYBOOK_DIR } from '../../../../core/src/shared/constants/config-folder.ts';

export interface ProjectAutomigrationData {
  configDir: string;
  packageManager: JsPackageManager;
  mainConfig: StorybookConfigRaw;
  mainConfigPath: string;
  previewConfigPath?: string;
  storybookVersion: string;
  beforeVersion: string;
  storiesPaths: string[];
  hasCsfFactoryPreview: boolean;
}

export interface AutomigrationCheckResultReport {
  result: any;
  status: 'check_succeeded' | 'check_failed' | 'not_applicable';
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

export interface MultiProjectRunAutomigrationOptions {
  automigrations: AutomigrationCheckResult[];
  dryRun?: boolean;
  yes?: boolean;
  skipInstall?: boolean;
  projects: ProjectAutomigrationData[];
}

/** Collects all applicable automigrations across multiple projects */
export async function collectAutomigrationsAcrossProjects(
  options: MultiProjectAutomigrationOptions
): Promise<AutomigrationCheckResult[]> {
  const { fixes, projects, taskLog } = options;
  const automigrationMap = new Map<FixId, AutomigrationCheckResult>();

  logger.debug(
    `Starting automigration collection across ${projects.length} projects and ${fixes.length} fixes...`
  );

  /** Utility to collect results and account for existing entries in the map. */
  function collectResult(
    fix: Fix,
    project: ProjectAutomigrationData,
    status: 'check_succeeded' | 'check_failed' | 'not_applicable',
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
    const projectName = shortenPath(project.configDir);

    taskLog.message(`Checking automigrations for ${projectName}...`);
    logger.debug(`Processing project: ${projectName}`);

    for (const fix of fixes) {
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
          hasCsfFactoryPreview: project.hasCsfFactoryPreview,
        };
        const result = await fix.check(checkOptions);

        if (result !== null) {
          collectResult(fix, project, 'check_succeeded', result);
        } else {
          collectResult(fix, project, 'not_applicable');
        }
      } catch (error) {
        collectResult(fix, project, 'check_failed');

        logger.debug(
          `Failed to check fix ${fix.id} for project ${shortenPath(project.configDir)}.`
        );
        logger.debug(`${error instanceof Error ? error.stack : String(error)}`);
        ErrorCollector.addError(error);
      }
    }
  }

  const allAutomigrations = Array.from(automigrationMap.values());

  const applicableAutomigrations = allAutomigrations.filter((am) =>
    am.reports.every((rep) => rep.status !== 'not_applicable')
  );
  // Single pass through detectedAutomigrations to build both arrays
  const { successAutomigrations, failedAutomigrations } = applicableAutomigrations.reduce(
    (acc, { fix, reports }) => {
      const successReports = reports.filter((report) => report.status === 'check_succeeded');
      const failedReports = reports.filter((report) => report.status === 'check_failed');

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
      `${applicableAutomigrations.length === 0 ? 'No automigrations detected' : `${applicableAutomigrations.length} automigration(s) detected`}`
    );
  }

  return allAutomigrations;
}

// Format project directories relative to git root
const formatProjectDirs = (list: AutomigrationCheckResult['reports']) => {
  const amountOfProjectsShown = 1;
  const relativeDirs = list
    .filter((p) => p.status === 'check_succeeded')
    .map((p) => shortenPath(p.project.configDir) || '.');
  if (relativeDirs.length <= amountOfProjectsShown) {
    return relativeDirs.join(', ');
  }
  const remaining = relativeDirs.length - amountOfProjectsShown;
  return `${relativeDirs.slice(0, amountOfProjectsShown).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
};

/** Prompts user to select which automigrations to run */
export async function promptForAutomigrations(
  automigrations: AutomigrationCheckResult[],
  options: { dryRun?: boolean; yes?: boolean }
): Promise<AutomigrationCheckResult[]> {
  if (automigrations.length === 0) {
    return [];
  }

  if (options.dryRun) {
    logger.log('Detected automigrations (dry run - no changes will be made):');
    automigrations.forEach(({ fix, reports: list }) => {
      logger.log(`  - ${fix.id} (${formatProjectDirs(list)})`);
    });
    return [];
  }

  if (options.yes) {
    logger.log('Running all detected automigrations:');
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
      defaultSelected: am.fix.defaultSelected ?? true,
    };
  });

  const selectedIds = await prompt.multiselect({
    message: 'Select automigrations to run',
    options: choices,
    initialValues: choices.filter((c) => c.defaultSelected).map((c) => c.value),
    required: false,
  });

  return automigrations.filter((am) => selectedIds.includes(am.fix.id));
}

// Group automigrations by project
type ConfigDir = string;
type ErrorMessage = string;
export type AutomigrationResult = {
  automigrationStatuses: Record<FixId, FixStatus>;
  automigrationErrors: Record<FixId, ErrorMessage>;
  /**
   * Core addons whose postinstall configuration must run AFTER dependencies are installed. A fix
   * that adds a core addon via `add(..., { skipPostinstall: true })` pushes the addon name here.
   * Deferral is required because an addon's postinstall hook can only be resolved once the package
   * is on disk, and the upgrade flow batches installs to the end of the run (after all projects'
   * automigrations); it configures these addons afterwards (see `upgrade.ts`).
   */
  addonsToPostinstall?: string[];
};
/** Runs selected automigrations for each project */
export async function runAutomigrationsForProjects(
  selectedAutomigrations: AutomigrationCheckResult[],
  options: MultiProjectRunAutomigrationOptions
): Promise<{
  projectResults: Record<ConfigDir, AutomigrationResult>;
  missedTransformations: MissedTransformationMatch[];
}> {
  const { dryRun, skipInstall, automigrations, yes, projects } = options;
  const projectResults: Record<ConfigDir, AutomigrationResult> = {};
  const missedTransformationPatterns: Array<{ fixId: FixId } & MissedTransformationPattern> = [];

  const applicableAutomigrations = selectedAutomigrations.filter((am) =>
    am.reports.every((rep) => rep.status !== 'not_applicable')
  );
  const projectAutomigrationResults = new Map<
    ConfigDir,
    {
      fix: Fix;
      project: ProjectAutomigrationData;
      result: any;
      status: AutomigrationCheckResultReport['status'];
    }[]
  >();

  // selectedAutomigrations -> { fix, reports } -> reports (status passed or failed or skipped) -> project
  for (const automigration of automigrations) {
    for (const report of automigration.reports) {
      const { project, result, status } = report;
      const existing = projectAutomigrationResults.get(project.configDir) || [];

      if (existing.length > 0) {
        existing.push({
          fix: automigration.fix,
          project,
          result,
          status,
        });
      } else {
        projectAutomigrationResults.set(project.configDir, [
          {
            fix: automigration.fix,
            project,
            result,
            status,
          },
        ]);
      }
    }
  }

  // Run automigrations for each project
  let projectIndex = 0;
  for (const [configDir, projectAutomigration] of projectAutomigrationResults) {
    const countPrefix =
      projectAutomigrationResults.size > 1
        ? `(${++projectIndex}/${projectAutomigrationResults.size}) `
        : '';

    const { project } = projectAutomigration[0];

    const projectName = shortenPath(project.configDir);

    // If there isn't any applicable automigrations, we don't need to use the task log
    const taskLog =
      applicableAutomigrations.length > 0
        ? prompt.taskLog({
            id: `automigrate-${projectName}`,
            title: `${countPrefix}Running automigrations for ${projectName}`,
          })
        : {
            message: (message: string) => {
              logger.debug(`${message}`);
            },
            error: (message: string) => {
              logger.debug(`${message}`);
            },
            success: (message: string) => {
              logger.debug(`${message}`);
            },
          };
    const fixResults: Record<FixId, FixStatus> = {};
    const fixFailures: Record<FixId, ErrorMessage> = {};
    // Core addons added by fixes that must be configured after the upgrade installs dependencies.
    const addonsToPostinstall: string[] = [];

    for (const automigration of projectAutomigration) {
      const { fix, result, project, status } = automigration;

      if (status === 'not_applicable') {
        fixResults[fix.id] = FixStatus.UNNECESSARY;
        continue;
      }

      if (status === 'check_failed') {
        fixResults[fix.id] = FixStatus.CHECK_FAILED;
        continue;
      }

      // it is only skipped when the current automigration
      // is either not selected by the user (for a particular proejct)
      // therefore we need to check for configDir as well as fix id matches
      const hasBeenSelected = selectedAutomigrations.some(
        (am) =>
          am.fix.id === fix.id &&
          am.reports.some((report) => report.project.configDir === project.configDir)
      );
      if (!hasBeenSelected) {
        fixResults[fix.id] = FixStatus.SKIPPED;
        continue;
      }

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
            yes,
            addonsToPostinstall,
          };

          await fix.run(runOptions);
          fixResults[fix.id] = FixStatus.SUCCEEDED;
          missedTransformationPatterns.push(...collectMissedTransformationPatterns(fix, result));
          taskLog.message(CLI_COLORS.success(`${logger.SYMBOLS.success} ${fix.id}`));
        }
      } catch (error) {
        const errorMessage =
          (error instanceof Error ? error.stack : String(error)) ?? 'Unknown error';
        fixResults[fix.id] = FixStatus.FAILED;
        fixFailures[fix.id] = sanitizeError(error as Error);
        taskLog.message(CLI_COLORS.error(`${logger.SYMBOLS.error} ${automigration.fix.id}`));
        logger.debug(errorMessage);
        ErrorCollector.addError(error);
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

    projectResults[configDir] = {
      automigrationStatuses: fixResults,
      automigrationErrors: fixFailures,
      addonsToPostinstall,
    };
  }

  const safeFiles = projects.flatMap((p) =>
    [p.mainConfigPath, p.previewConfigPath, ...p.storiesPaths].filter(Boolean)
  ) as string[];
  const safeDirs = projects.map((p) => p.configDir);
  // When 2+ projects both successfully run the same detectMissedTransformations-opted
  // fix, the same { fixId, label } pattern is pushed once per project above. Dedupe by
  // fixId+label before scanning so a single leftover file isn't matched (and reported)
  // multiple times under the same group.
  const dedupedPatterns = [
    ...new Map(missedTransformationPatterns.map((p) => [`${p.fixId}::${p.label}`, p])).values(),
  ];
  const missedTransformations =
    dedupedPatterns.length > 0
      ? await detectMissedTransformations({
          patterns: dedupedPatterns,
          safeFiles,
          safeDirs,
        })
      : [];

  return { projectResults, missedTransformations };
}

export async function runAutomigrations(
  projects: CollectProjectsSuccessResult[],
  options: UpgradeOptions
): Promise<{
  detectedAutomigrations: AutomigrationCheckResult[];
  automigrationResults: Record<string, AutomigrationResult>;
  missedTransformations: MissedTransformationMatch[];
}> {
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
    hasCsfFactoryPreview: project.hasCsfFactoryPreview,
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

  // Filter out automigrations that should run
  const successfulAutomigrations = detectedAutomigrations.filter((am) =>
    am.reports.some((report) => report.status === 'check_succeeded')
  );

  // Prompt user to select which automigrations to run
  const selectedAutomigrations = await promptForAutomigrations(successfulAutomigrations, {
    dryRun: options.dryRun,
    yes: options.yes,
  });
  // Run selected automigrations for each project
  const { projectResults: automigrationResults, missedTransformations } =
    await runAutomigrationsForProjects(selectedAutomigrations, {
      automigrations: detectedAutomigrations,
      dryRun: options.dryRun,
      yes: options.yes,
      skipInstall: options.skipInstall,
      projects: projectAutomigrationData,
    });

  // Special case handling for rnstorybook-config which renames the config dir
  // TODO: Remove this as soon as the rn-storybook-config automigration is removed
  Object.entries(automigrationResults).forEach(([configDir, resultData]) => {
    if (resultData.automigrationStatuses[rnstorybookConfig.id] === FixStatus.SUCCEEDED) {
      const project = projects.find((p) => p.configDir === configDir);
      if (project) {
        const oldConfigDir = project.configDir;
        project.configDir = project.configDir.replace('.storybook', RN_STORYBOOK_DIR);
        automigrationResults[project.configDir] = resultData;
        delete automigrationResults[oldConfigDir];
      }
    }
  });

  return {
    detectedAutomigrations,
    automigrationResults,
    missedTransformations,
  };
}
