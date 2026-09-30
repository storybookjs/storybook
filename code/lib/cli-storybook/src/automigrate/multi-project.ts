import type { JsPackageManager } from 'storybook/internal/common';
import { CLI_COLORS, type TaskLogInstance, logger, prompt } from 'storybook/internal/node-logger';
import { ErrorCollector, sanitizeError } from 'storybook/internal/telemetry';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { UpgradeOptions } from '../upgrade.ts';
import { shortenPath } from '../util.ts';
import type { CollectProjectsSuccessResult } from '../util.ts';
import { resolveRequestedFeatures } from './fixes/experimental-features.ts';
import { allFixes } from './fixes/index.ts';
import { type FixFileFailure, pluralFiles, reportFileFailures } from './helpers/failure-report.ts';
import { applyFixes, type CheckedFix, detectApplicable, runCheck } from './pipeline.ts';
import type { Fix, FixId } from './types.ts';
import { FixStatus } from './types.ts';

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
  status: 'check_succeeded' | 'check_failed' | 'not_applicable';
  project: ProjectAutomigrationData;
  /** The fix's hooks went through every file and would change none. */
  verified?: boolean;
  recheck?: CheckedFix['recheck'];
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
  /** Fix ids the user asked for explicitly; forwarded to `check` as `requested`. */
  requestedFixIds?: string[];
}

export interface MultiProjectRunAutomigrationOptions {
  automigrations: AutomigrationCheckResult[];
  dryRun?: boolean;
  yes?: boolean;
  skipInstall?: boolean;
}

/** Collects all applicable automigrations across multiple projects */
export async function collectAutomigrationsAcrossProjects(
  options: MultiProjectAutomigrationOptions
): Promise<AutomigrationCheckResult[]> {
  const { fixes, projects, taskLog, requestedFixIds } = options;
  const automigrationMap = new Map<FixId, AutomigrationCheckResult>();

  logger.debug(
    `Starting automigration collection across ${projects.length} projects and ${fixes.length} fixes...`
  );

  /** Utility to collect results and account for existing entries in the map. */
  function collectResult(
    fix: Fix,
    project: ProjectAutomigrationData,
    status: 'check_succeeded' | 'check_failed' | 'not_applicable',
    result?: any,
    verified?: boolean,
    recheck?: CheckedFix['recheck']
  ) {
    const report = { project, result, status, verified, recheck };
    const existing = automigrationMap.get(fix.id);
    if (existing) {
      existing.reports.push(report);
    } else {
      automigrationMap.set(fix.id, { fix, reports: [report] });
    }
  }

  // Run check for each fix on each project
  for (const project of projects) {
    const projectName = shortenPath(project.configDir);

    taskLog.message(`Checking automigrations for ${projectName}...`);
    logger.debug(`Processing project: ${projectName}`);

    const checks: (CheckedFix & { failed?: boolean })[] = [];

    for (const fix of fixes) {
      try {
        logger.debug(`Checking fix ${fix.id} for project ${projectName}...`);

        checks.push(
          await runCheck(fix, {
            packageManager: project.packageManager,
            configDir: project.configDir,
            mainConfig: project.mainConfig,
            storybookVersion: project.storybookVersion,
            beforeVersion: project.beforeVersion,
            requested: requestedFixIds?.includes(fix.id),
            previewConfigPath: project.previewConfigPath,
            mainConfigPath: project.mainConfigPath,
            storiesPaths: project.storiesPaths,
          })
        );
      } catch (error) {
        checks.push({ fix, result: null, failed: true });

        logger.debug(
          `Failed to check fix ${fix.id} for project ${shortenPath(project.configDir)}.`
        );
        logger.debug(`${error instanceof Error ? error.stack : String(error)}`);
        ErrorCollector.addError(error);
      }
    }

    const applicable = await detectApplicable(
      project,
      checks.filter(({ result }) => result !== null)
    );
    for (const check of checks) {
      const { fix, result, failed } = check;
      if (failed) {
        collectResult(fix, project, 'check_failed');
      } else if (!applicable.includes(check)) {
        collectResult(
          fix,
          project,
          'not_applicable',
          undefined,
          result !== null && !!fix.transform && !fix.run
        );
      } else {
        collectResult(fix, project, 'check_succeeded', result, undefined, check.recheck);
      }
    }
  }

  const allAutomigrations = Array.from(automigrationMap.values());

  const applicableAutomigrations = allAutomigrations.filter((am) =>
    am.reports.some((rep) => rep.status !== 'not_applicable')
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
  options: { dryRun?: boolean; yes?: boolean; preselectedIds?: string[] }
): Promise<AutomigrationCheckResult[]> {
  if (automigrations.length === 0) {
    return [];
  }

  const logSelection = (title: string, selection: AutomigrationCheckResult[]) => {
    logger.log(title);
    selection.forEach(({ fix, reports: list }) => {
      logger.log(`  - ${fix.id} (${formatProjectDirs(list)})`);
    });
  };

  const preselectedIds = new Set(options.preselectedIds ?? []);

  if (options.dryRun) {
    logSelection('Detected automigrations (dry run - no changes will be made):', automigrations);
    return [];
  }

  if (options.yes) {
    const selected = automigrations.filter(
      ({ fix }) =>
        preselectedIds.has(fix.id) || fix.defaultSelected !== false || fix.promptType === 'auto'
    );
    logSelection('Running all detected automigrations:', selected);
    return selected;
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
      defaultSelected: preselectedIds.has(am.fix.id) || (am.fix.defaultSelected ?? true),
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
  /** Files that fixes could not transform; the other files of those fixes were migrated. */
  fileFailures: FixFileFailure[];
};
/** Runs selected automigrations for each project */
export async function runAutomigrationsForProjects(
  selectedAutomigrations: AutomigrationCheckResult[],
  options: MultiProjectRunAutomigrationOptions
): Promise<Record<ConfigDir, AutomigrationResult>> {
  const { skipInstall, automigrations, yes } = options;
  const projectResults: Record<ConfigDir, AutomigrationResult> = {};

  const applicableAutomigrations = selectedAutomigrations.filter((am) =>
    am.reports.some((rep) => rep.status !== 'not_applicable')
  );
  const projectAutomigrationResults = new Map<
    ConfigDir,
    {
      fix: Fix;
      project: ProjectAutomigrationData;
      result: any;
      status: AutomigrationCheckResultReport['status'];
      recheck?: CheckedFix['recheck'];
    }[]
  >();

  // selectedAutomigrations -> { fix, reports } -> reports (status passed or failed or skipped) -> project
  for (const automigration of automigrations) {
    for (const report of automigration.reports) {
      const { project } = report;
      const existing = projectAutomigrationResults.get(project.configDir) || [];

      if (existing.length > 0) {
        existing.push({ ...report, fix: automigration.fix });
      } else {
        projectAutomigrationResults.set(project.configDir, [{ ...report, fix: automigration.fix }]);
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
    const fileFailures: FixFileFailure[] = [];

    const isSelected = (fix: Fix) =>
      selectedAutomigrations.some(
        (am) =>
          am.fix.id === fix.id &&
          am.reports.some((report) => report.project.configDir === project.configDir)
      );
    const selected: CheckedFix[] = [];
    for (const { fix, result, status, recheck } of projectAutomigration) {
      if (status === 'not_applicable') {
        fixResults[fix.id] = FixStatus.UNNECESSARY;
      } else if (status === 'check_failed') {
        fixResults[fix.id] = FixStatus.CHECK_FAILED;
      } else if (!isSelected(fix)) {
        fixResults[fix.id] = FixStatus.SKIPPED;
      } else if (fix.run || fix.transform) {
        selected.push({ fix, result, recheck });
      }
    }

    const outcomes = await applyFixes(
      {
        packageManager: project.packageManager,
        mainConfigPath: project.mainConfigPath,
        previewConfigPath: project.previewConfigPath,
        mainConfig: project.mainConfig,
        configDir: project.configDir,
        skipInstall,
        storybookVersion: project.storybookVersion,
        storiesPaths: project.storiesPaths,
        yes,
        addonsToPostinstall,
      },
      selected
    );
    for (const [fixId, outcome] of outcomes) {
      if (outcome.status === 'skipped') {
        fixResults[fixId] = FixStatus.SKIPPED;
        taskLog.message(CLI_COLORS.warning(`▲ ${fixId}: cancelled`));
        continue;
      }
      fileFailures.push(...outcome.fileFailures.map((failure) => ({ ...failure, fixId })));
      const skipped = outcome.fileFailures.length;
      if (outcome.status === 'failed') {
        fixResults[fixId] = FixStatus.FAILED;
        fixFailures[fixId] = sanitizeError(outcome.error as Error);
        taskLog.message(CLI_COLORS.error(`${logger.SYMBOLS.error} ${fixId}`));
        // Shown with the task log when the project fails, e.g. manual steps a fix could not take.
        taskLog.message(
          outcome.error instanceof Error ? outcome.error.message : String(outcome.error)
        );
        logger.debug(outcome.error instanceof Error ? outcome.error.stack : String(outcome.error));
        ErrorCollector.addError(outcome.error);
      } else {
        fixResults[fixId] = FixStatus.SUCCEEDED;
        taskLog.message(
          CLI_COLORS.success(
            `${logger.SYMBOLS.success} ${fixId}${skipped > 0 ? ` (${pluralFiles(skipped)} skipped)` : ''}`
          )
        );
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
      fileFailures,
    };
  }

  return projectResults;
}

export async function runAutomigrations(
  projects: CollectProjectsSuccessResult[],
  options: UpgradeOptions
): Promise<{
  detectedAutomigrations: AutomigrationCheckResult[];
  automigrationResults: Record<string, AutomigrationResult>;
}> {
  const requestedFeatures = resolveRequestedFeatures(options.features);
  const requestedFixIds = requestedFeatures.map(({ fixId }) => fixId);

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
    requestedFixIds,
  });

  // Filter out automigrations that should run
  const successfulAutomigrations = detectedAutomigrations.filter((am) =>
    am.reports.some((report) => report.status === 'check_succeeded')
  );

  requestedFeatures
    .filter(({ fixId }) => !successfulAutomigrations.some((am) => am.fix.id === fixId))
    .forEach(({ name, fixId }) => {
      const checkFailed = detectedAutomigrations
        .find((am) => am.fix.id === fixId)
        ?.reports.some((report) => report.status === 'check_failed');
      logger.warn(
        checkFailed
          ? `Skipping --features ${name}: the '${fixId}' migration check failed. Run with --debug for details.`
          : `Skipping --features ${name}: the '${fixId}' migration does not apply here. ${name} is either already set in your main config, unsupported by your Storybook version, or missing a prerequisite.`
      );
    });

  // Prompt user to select which automigrations to run
  const selectedAutomigrations = await promptForAutomigrations(successfulAutomigrations, {
    dryRun: options.dryRun,
    yes: options.yes,
    preselectedIds: requestedFixIds,
  });
  // Run selected automigrations for each project
  const automigrationResults = await runAutomigrationsForProjects(selectedAutomigrations, {
    automigrations: detectedAutomigrations,
    dryRun: options.dryRun,
    yes: options.yes,
    skipInstall: options.skipInstall,
  });

  if (!options.dryRun) {
    const results = Object.values(automigrationResults);
    const fileFailures = results.flatMap((result) => result.fileFailures);
    await reportFileFailures(fileFailures, [
      ...results.flatMap(({ automigrationStatuses }) =>
        Object.keys(automigrationStatuses).filter(
          (fixId) => automigrationStatuses[fixId] === FixStatus.SUCCEEDED
        )
      ),
      ...fileFailures.map(({ fixId }) => fixId),
      ...detectedAutomigrations
        .filter(({ reports }) => reports.some(({ verified }) => verified))
        .map(({ fix }) => fix.id),
    ]);
  }

  return {
    detectedAutomigrations,
    automigrationResults,
  };
}
