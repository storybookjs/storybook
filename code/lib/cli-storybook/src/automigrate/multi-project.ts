import type { JsPackageManager } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

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
        console.error(`Failed to check fix ${fix.id} for project ${project.configDir}:`, error);
      }
    }
  }

  return Array.from(automigrationMap.values());
}

/** Prompts user to select which automigrations to run */
export async function promptForAutomigrations(
  automigrations: AutomigrationCheckResult[],
  gitRoot: string,
  options: { dryRun?: boolean; yes?: boolean }
): Promise<AutomigrationCheckResult[]> {
  if (automigrations.length === 0) {
    return [];
  }

  // Format project directories relative to git root
  const formatProjectDirs = (projects: ProjectAutomigrationData[]) => {
    const relativeDirs = projects.map((p) => p.configDir.replace(gitRoot, '') || '.');
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
  const choices = automigrations.map((am) => ({
    value: am.fix.id,
    label: `${am.fix.id} (${formatProjectDirs(am.projects)})`,
    hint: am.fix.prompt(am.result),
  }));

  prompt.log(dedent`
    We have detected the following automigrations which are applicable for your Storybook project(s):
  `);

  const selectedIds = await prompt.multiselect({
    message: 'Select automigrations to run',
    options: choices,
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
    prompt.log(`\n📦 Running automigrations for ${picocolors.cyan(configDir)}:`);

    const project = automigrations[0].projects.find((p) => p.configDir === configDir);

    if (!project) {
      continue;
    }

    const fixResults: Record<FixId, FixStatus> = {};

    for (const automigration of automigrations) {
      const { fix, result } = automigration;

      try {
        // Determine prompt type
        const promptType =
          typeof fix.promptType === 'function'
            ? await fix.promptType(result)
            : (fix.promptType ?? 'auto');

        prompt.log(`  - ${picocolors.cyan(fix.id)}...`);

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
          prompt.log(`    ✅ Completed`);
        }
      } catch (error) {
        fixResults[fix.id] = FixStatus.FAILED;
        prompt.log(`    ❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    projectResults[configDir] = fixResults;
  }

  return projectResults;
}
