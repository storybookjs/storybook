import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { type JsPackageManager, temporaryFile } from 'storybook/internal/common';
import { prompt } from 'storybook/internal/node-logger';
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
import { shouldRunFix } from './helpers/checkVersionRange';
import { cleanLog } from './helpers/cleanLog';
import { logMigrationSummary } from './helpers/logMigrationSummary';
import { getStorybookData } from './helpers/mainConfigFile';

const LOG_FILE_NAME = 'migration-storybook.log';
const LOG_FILE_PATH = join(process.cwd(), LOG_FILE_NAME);
let TEMP_LOG_FILE_PATH = '';

const originalStdOutWrite = process.stdout.write.bind(process.stdout);
const originalStdErrWrite = process.stderr.write.bind(process.stdout);

const augmentLogsToFile = async () => {
  TEMP_LOG_FILE_PATH = await temporaryFile({ name: LOG_FILE_NAME });
  const logStream = createWriteStream(TEMP_LOG_FILE_PATH);

  process.stdout.write = (d: string) => {
    originalStdOutWrite(d);
    return logStream.write(cleanLog(d));
  };
  process.stderr.write = (d: string) => {
    return logStream.write(cleanLog(d));
  };
};

const cleanup = () => {
  process.stdout.write = originalStdOutWrite;
  process.stderr.write = originalStdErrWrite;
};

const logAvailableMigrations = () => {
  const availableFixes = [...allFixes, ...commandFixes]
    .map((f) => picocolors.yellow(f.id))
    .map((x) => `- ${x}`)
    .join('\n');

  console.log();
  prompt.log(dedent`
    The following migrations are available:
    ${availableFixes}
  `);
};

export const doAutomigrate = async (options: AutofixOptionsFromCLI) => {
  const {
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    storybookVersion,
    configDir,
    packageManager,
    storiesPaths,
  } = await getStorybookData({
    configDir: options.configDir,
    packageManagerName: options.packageManager,
  });

  if (!storybookVersion) {
    throw new Error('Could not determine Storybook version');
  }

  if (!mainConfigPath) {
    throw new Error('Could not determine main config path');
  }

  const outcome = await automigrate({
    ...options,
    packageManager,
    storybookVersion,
    beforeVersion: storybookVersion,
    mainConfigPath,
    mainConfig,
    previewConfigPath,
    configDir,
    isUpgrade: false,
    isLatest: false,
    storiesPaths,
  });

  packageManager.installDependencies();

  if (outcome && !options.skipDoctor) {
    await doctor({ configDir, packageManager: options.packageManager });
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
  beforeVersion,
  renderer: rendererPackage,
  skipInstall,
  hideMigrationSummary = false,
  isUpgrade,
  isLatest,
  storiesPaths,
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
    prompt.log(`🔎 Running migration ${picocolors.magenta(fixId)}..`);

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
    prompt.log(`📭 No migrations found for ${picocolors.magenta(fixId)}.`);
    logAvailableMigrations();
    return null;
  }

  await augmentLogsToFile();

  prompt.log('🔎 checking possible migrations..');

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
    beforeVersion,
    isUpgrade: !!isUpgrade,
    dryRun,
    yes,
    storiesPaths,
  });

  const hasFailures = Object.values(fixResults).some(
    (r) => r === FixStatus.FAILED || r === FixStatus.CHECK_FAILED
  );

  // if migration failed, display a log file in the users cwd
  if (hasFailures) {
    await rename(TEMP_LOG_FILE_PATH, join(process.cwd(), LOG_FILE_NAME));
  } else {
    await rm(TEMP_LOG_FILE_PATH, { recursive: true, force: true });
  }

  if (!hideMigrationSummary) {
    const installationMetadata = await packageManager.findInstallations([
      '@storybook/*',
      'storybook',
    ]);

    prompt.log('');
    logMigrationSummary({ fixResults, fixSummary, logFile: LOG_FILE_PATH, installationMetadata });
    prompt.log('');
  }

  cleanup();

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
  beforeVersion: string;
  isUpgrade?: boolean;
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
  beforeVersion,
  isUpgrade,
  storiesPaths,
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
      if (shouldRunFix(f, beforeVersion, storybookVersion, !!isUpgrade)) {
        prompt.debug(`Running ${picocolors.cyan(f.id)} migration checks`);
        result = await f.check({
          packageManager,
          configDir,
          rendererPackage,
          mainConfig,
          storybookVersion,
          previewConfigPath,
          mainConfigPath,
          storiesPaths,
        });
        prompt.debug(`End of ${picocolors.cyan(f.id)} migration checks`);
      }
    } catch (error) {
      prompt.warn(`⚠️  failed to check fix ${picocolors.bold(f.id)}`);
      if (error instanceof Error) {
        prompt.error(`\n${error.stack}`);
        fixSummary.failed[f.id] = error.message;
      }
      fixResults[f.id] = FixStatus.CHECK_FAILED;
    }

    if (result) {
      const promptType: Prompt =
        typeof f.promptType === 'function' ? await f.promptType(result) : (f.promptType ?? 'auto');

      prompt.log(`\n🔎 found a '${picocolors.cyan(f.id)}' migration:`);

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
        title: `${getTitle()}: ${picocolors.cyan(f.id)}`,
      });

      prompt.logBox(f.prompt(result));
      // currentTaskLogger.message(f.prompt(result));

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

          prompt.log('');
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
          const shouldRun = await prompt.confirm(
            {
              message: `Do you want to run the '${picocolors.cyan(f.id)}' migration on your project?`,
              initialValue: f.promptDefaultValue ?? true,
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
            });
            prompt.log(`✅ ran ${picocolors.cyan(f.id)} migration`);

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
