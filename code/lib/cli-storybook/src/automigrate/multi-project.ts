import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { UpgradeOptions } from '../upgrade';
import { shortenPath } from '../util';
import type { CollectProjectsSuccessResult } from '../util';
import { allFixes } from './fixes';
import { rnstorybookConfig } from './fixes/rnstorybook-config';
import { shouldRunFix } from './helpers/checkVersionRange';
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
}

/** Collects all applicable automigrations across multiple projects */
export async function collectAutomigrationsAcrossProjects(
  options: MultiProjectAutomigrationOptions
): Promise<AutomigrationCheckResult[]> {
  const { fixes, projects } = options;
  const automigrationMap = new Map<FixId, AutomigrationCheckResult>();

  // Run check for each fix on each project
  for (const project of projects) {
    for (const fix of fixes) {
      try {
        // Check version range if this is an upgrade
        if (fix.versionRange) {
          const { beforeVersion, storybookVersion } = project;

          // Skip if version doesn't match the range
          if (!shouldRunFix(fix, beforeVersion, storybookVersion, true)) {
            continue;
          }
        }

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
        prompt.error(
          `Failed to check fix ${fix.id} for project ${project.configDir}:\n` + String(error)
        );
      }
    }
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
    const relativeDirs = projects.map((p) => shortenPath(p.configDir) || '.');
    if (relativeDirs.length <= 3) {
      return relativeDirs.join(', ');
    }
    const remaining = relativeDirs.length - 3;
    return `${relativeDirs.slice(0, 3).join(', ')}${remaining > 0 ? ` and ${remaining} more...` : ''}`;
  };

  if (options.dryRun) {
    prompt.log('\n📋 Detected automigrations (dry run - no changes will be made):');
    automigrations.forEach((am) => {
      prompt.log(`  - ${am.fix.id} (${formatProjectDirs(am.projects)})`);
    });
    return [];
  }

  if (options.yes) {
    prompt.log('\n✅ Running all detected automigrations:');
    automigrations.forEach((am) => {
      prompt.log(`  - ${am.fix.id} (${formatProjectDirs(am.projects)})`);
    });
    return automigrations;
  }

  // Create choices for multiselect prompt
  const choices = automigrations.map((am) => {
    const hint = [];

    hint.push(`${am.fix.prompt(am.result)}`);

    if (am.fix.link) {
      hint.push(`More info: ${picocolors.blue(am.fix.link)}`);
    }

    return {
      value: am.fix.id,
      label: `${am.fix.id} (${formatProjectDirs(am.projects)})`,
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
  for (const [configDir, automigrations] of projectAutomigrations) {
    const project = automigrations[0].projects.find((p) => p.configDir === configDir);

    if (!project) {
      continue;
    }

    const projectName = picocolors.cyan(shortenPath(project.configDir));
    const taskLog = prompt.taskLog({
      title: `Running automigrations for ${projectName}:`,
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

        taskLog.message(`  - ${picocolors.cyan(fix.id)}...`);

        if (promptType === 'manual') {
          // For manual migrations, show the prompt and mark as manual
          prompt.log(`    ℹ️  Manual migration required:`);
          prompt.log(`    ${fix.prompt(result).split('\n').join('\n    ')}`);
          fixResults[fix.id] = FixStatus.MANUAL_SUCCEEDED;
        } else if (promptType === 'notification') {
          // For notifications, just show the message
          prompt.log(`    ℹ️  Notification:`);
          prompt.log(`    ${fix.prompt(result).split('\n').join('\n    ')}`);
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
        taskLog.error(`    ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    taskLog.success(`Completed automigrations for ${projectName}`);

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

  prompt.log(`Detecting automigrations for ${projectAutomigrationData.length} projects...`);

  // Collect all applicable automigrations across all projects
  const detectedAutomigrations = await collectAutomigrationsAcrossProjects({
    fixes: allFixes,
    projects: projectAutomigrationData,
    dryRun: options.dryRun,
    yes: options.yes,
    skipInstall: options.skipInstall,
  });

  // Prompt user to select which automigrations to run
  const selectedAutomigrations = await promptForAutomigrations(detectedAutomigrations, {
    dryRun: options.dryRun,
    yes: options.yes,
  });

  prompt.debug('Running automigrations...');
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
