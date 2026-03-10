import { type JsPackageManager } from 'storybook/internal/common';
import { versions } from 'storybook/internal/common';
import { logTracker, logger, prompt } from 'storybook/internal/node-logger';
import { AutomigrateError } from 'storybook/internal/server-errors';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import picocolors from 'picocolors';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import { doctor } from '../doctor';
import type {
  AutofixOptions,
  AutofixOptionsFromCLI,
  Fix,
  FixId,
  FixSummary,
  PreCheckFailure,
  Prompt,
} from './fixes';
import { FixStatus, allFixes, commandFixes } from './fixes';
import { upgradeStorybookRelatedDependencies } from './fixes/upgrade-storybook-related-dependencies';
import { logMigrationSummary } from './helpers/logMigrationSummary';
import { getStorybookData } from './helpers/mainConfigFile';

const logAvailableMigrations = () => {
  const availableFixes = [...allFixes, ...commandFixes]
    .map((f) => picocolors.yellow(f.id))
    .map((x) => `- ${x}`)
    .join('\n');

  logger.log(dedent`
    The following migrations are available:
    ${availableFixes}
  `);
};

const hasFailures = (fixResults: Record<string, FixStatus> | undefined): boolean => {
  return Object.values(fixResults || {}).some(
    (r) => r === FixStatus.FAILED || r === FixStatus.CHECK_FAILED
  );
};

export const doAutomigrate = async (options: AutofixOptionsFromCLI) => {
  logger.debug('Extracting storybook data...');
  const {
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    versionInstalled,
    configDir,
    packageManager,
    storiesPaths,
    hasCsfFactoryPreview,
  } = await getStorybookData({
    configDir: options.configDir,
    packageManagerName: options.packageManager,
  });

  if (!mainConfigPath) {
    throw new Error('Could not determine main config path');
  }

  const outcome = await automigrate({
    ...options,
    packageManager,
    storybookVersion: versionInstalled || versions.storybook,
    mainConfigPath,
    mainConfig,
    previewConfigPath,
    configDir,
    isUpgrade: false,
    isLatest: false,
    storiesPaths,
    hasCsfFactoryPreview,
  });

  // only install dependencies if the outcome contains any fixes that were not failed or skipped
  const hasAppliedFixes = Object.values(outcome?.fixResults ?? {}).some(
    (r) => r === FixStatus.SUCCEEDED || r === FixStatus.MANUAL_SUCCEEDED
  );

  if (hasAppliedFixes && !options.skipInstall) {
    await packageManager.installDependencies();
  }

  if (outcome && !options.skipDoctor) {
    await doctor({ configDir, packageManager: options.packageManager });
  }

  if (hasFailures(outcome?.fixResults)) {
    const failedMigrations = Object.entries(outcome?.fixResults ?? {})
      .filter(([, status]) => status === FixStatus.FAILED || status === FixStatus.CHECK_FAILED)
      .map(([id, status]) => {
        const statusLabel = status === FixStatus.CHECK_FAILED ? 'check failed' : 'failed';
        return `${picocolors.cyan(id)} (${statusLabel})`;
      });

    throw new AutomigrateError({ errors: failedMigrations });
  }
};

export const automigrate = async ({
  fixId,
  fixes: inputFixes,
  dryRun,
  yes,
  packageManager,
  list,
  configDir,
  mainConfig,
  mainConfigPath,
  previewConfigPath,
  storybookVersion,
  renderer: rendererPackage,
  skipInstall,
  hideMigrationSummary = false,
  isUpgrade,
  isLatest,
  storiesPaths,
  hasCsfFactoryPreview,
  glob,
}: AutofixOptions): Promise<{
  fixResults: Record<string, FixStatus>;
  preCheckFailure?: PreCheckFailure;
} | null> => {
  if (list) {
    logAvailableMigrations();
    return null;
  }

  // if an on-command migration is triggered, run it and bail
  const commandFix = commandFixes.find((f) => f.id === fixId);
  if (commandFix) {
    logger.step(`Running migration ${picocolors.magenta(fixId)}..`);

    await commandFix.run({
      mainConfigPath,
      previewConfigPath,
      packageManager,
      configDir,
      dryRun,
      mainConfig,
      result: null,
      storybookVersion,
      storiesPaths,
      yes,
      glob,
    });

    return null;
  }

  const selectedFixes: Fix[] =
    inputFixes ||
    allFixes.filter((fix) => {
      // we only allow this automigration when the user explicitly asks for it, or they are upgrading to the latest version of storybook
      if (
        fix.id === upgradeStorybookRelatedDependencies.id &&
        isLatest === false &&
        fixId !== upgradeStorybookRelatedDependencies.id
      ) {
        return false;
      }

      return true;
    });
  const fixes: Fix[] = fixId ? selectedFixes.filter((f) => f.id === fixId) : selectedFixes;

  if (fixId && fixes.length === 0) {
    logger.log(`📭 No migrations found for ${picocolors.magenta(fixId)}.`);
    logAvailableMigrations();
    return null;
  }

  logger.step('Checking possible migrations..');

  const { fixResults, fixSummary, preCheckFailure } = await runFixes({
    fixes,
    packageManager,
    rendererPackage,
    skipInstall,
    configDir,
    previewConfigPath,
    mainConfig,
    mainConfigPath,
    storybookVersion,
    isUpgrade: !!isUpgrade,
    dryRun,
    yes,
    storiesPaths,
    hasCsfFactoryPreview,
  });

  // if migration failed, display a log file in the users cwd
  if (hasFailures(fixResults)) {
    logTracker.enableLogWriting();
  }

  if (!hideMigrationSummary) {
    logMigrationSummary({
      fixResults,
      fixSummary,
    });
  }

  return { fixResults, preCheckFailure };
};

type RunFixesOptions = {
  fixes: Fix[];
  yes?: boolean;
  storiesPaths: string[];
  dryRun?: boolean;
  rendererPackage?: string;
  skipInstall?: boolean;
  configDir: string;
  packageManager: JsPackageManager;
  mainConfigPath: string;
  previewConfigPath?: string;
  mainConfig: StorybookConfigRaw;
  storybookVersion: string;
  isUpgrade?: boolean;
  hasCsfFactoryPreview: boolean;
};

export async function runFixes({
  fixes,
  dryRun,
  yes,
  rendererPackage,
  skipInstall,
  configDir,
  packageManager,
  mainConfig,
  mainConfigPath,
  previewConfigPath,
  storybookVersion,
  storiesPaths,
  hasCsfFactoryPreview,
}: RunFixesOptions): Promise<{
  preCheckFailure?: PreCheckFailure;
  fixResults: Record<FixId, FixStatus>;
  fixSummary: FixSummary;
}> {
  const fixResults = {} as Record<FixId, FixStatus>;
  const fixSummary: FixSummary = { succeeded: [], failed: {}, manual: [], skipped: [] };

  for (let i = 0; i < fixes.length; i += 1) {
    const f = fixes[i] as Fix;
    let result;

    try {
      logger.debug(`Running ${picocolors.cyan(f.id)} migration checks`);
      result = await f.check({
        packageManager,
        configDir,
        rendererPackage,
        mainConfig,
        storybookVersion,
        previewConfigPath,
        mainConfigPath,
        storiesPaths,
        hasCsfFactoryPreview,
      });
      logger.debug(`End of ${picocolors.cyan(f.id)} migration checks`);
    } catch (error) {
      logger.warn(`⚠️  failed to check fix ${picocolors.bold(f.id)}`);
      if (error instanceof Error) {
        logger.error(`\n${error.stack}`);
        fixSummary.failed[f.id] = error.message;
      }
      fixResults[f.id] = FixStatus.CHECK_FAILED;
    }

    if (result) {
      const promptType: Prompt =
        typeof f.promptType === 'function' ? await f.promptType(result) : (f.promptType ?? 'auto');

      logger.log(`🔎 found a '${picocolors.cyan(f.id)}' migration:`);

      const getTitle = () => {
        switch (promptType) {
          case 'auto':
            return 'Automigration detected';
          case 'manual':
            return 'Manual migration detected';
          case 'notification':
            return 'Migration notification';
        }
      };

      const currentTaskLogger = prompt.taskLog({
        id: `automigrate-task-${f.id}`,
        title: `${getTitle()}: ${picocolors.cyan(f.id)}`,
      });

      logger.logBox(f.prompt());

      let runAnswer: { fix: boolean } | undefined;

      try {
        if (dryRun) {
          runAnswer = { fix: false };
        } else if (yes) {
          runAnswer = { fix: true };
          if (promptType === 'manual') {
            fixResults[f.id] = FixStatus.MANUAL_SUCCEEDED;
            fixSummary.manual.push(f.id);
          }
        } else if (promptType === 'manual') {
          fixResults[f.id] = FixStatus.MANUAL_SUCCEEDED;
          fixSummary.manual.push(f.id);

          const shouldContinue = await prompt.confirm(
            {
              message:
                'Select continue once you have made the required changes, or quit to exit the migration process',
              initialValue: true,
              active: 'continue',
              inactive: 'quit',
            },
            {
              onCancel: () => {
                throw new Error();
              },
            }
          );

          if (!shouldContinue) {
            fixResults[f.id] = FixStatus.MANUAL_SKIPPED;
            break;
          }
        } else if (promptType === 'auto') {
          const shouldRun = yes
            ? true
            : await prompt.confirm(
                {
                  message: `Do you want to run the '${picocolors.cyan(f.id)}' migration on your project?`,
                  initialValue: f.defaultSelected ?? true,
                },
                {
                  onCancel: () => {
                    throw new Error();
                  },
                }
              );
          runAnswer = { fix: shouldRun };
        } else if (promptType === 'notification') {
          const shouldContinue = await prompt.confirm(
            {
              message: `Do you want to continue?`,
            },
            {
              onCancel: () => {
                throw new Error();
              },
            }
          );
          runAnswer = { fix: shouldContinue };
        }
      } catch (err) {
        break;
      }

      if (promptType === 'auto') {
        invariant(runAnswer, 'runAnswer must be defined if not promptOnly');
        if (runAnswer.fix) {
          try {
            invariant(typeof f.run === 'function', 'run method should be available in fix.');
            invariant(mainConfigPath, 'Main config path should be defined to run migration.');
            await f.run({
              result,
              packageManager,
              dryRun,
              mainConfigPath,
              configDir,
              previewConfigPath,
              mainConfig,
              skipInstall,
              storybookVersion,
              storiesPaths,
              yes,
            });
            logger.log(`✅ ran ${picocolors.cyan(f.id)} migration`);

            fixResults[f.id] = FixStatus.SUCCEEDED;
            fixSummary.succeeded.push(f.id);
            currentTaskLogger.success(`Ran ${picocolors.cyan(f.id)} migration`);
          } catch (error) {
            fixResults[f.id] = FixStatus.FAILED;
            const errorMessage = error instanceof Error ? error.message : 'Failed to run migration';
            fixSummary.failed[f.id] = errorMessage;

            currentTaskLogger.error(`Error when running ${picocolors.cyan(f.id)} migration`);
          }
        } else {
          fixResults[f.id] = FixStatus.SKIPPED;
          fixSummary.skipped.push(f.id);
          currentTaskLogger.success(`Skipped ${picocolors.cyan(f.id)} migration`);
        }
      }
    } else {
      fixResults[f.id] = fixResults[f.id] || FixStatus.UNNECESSARY;
    }
  }

  return { fixResults, fixSummary };
}
