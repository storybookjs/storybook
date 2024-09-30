import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type JsPackageManager,
  JsPackageManagerFactory,
  getCoercedStorybookVersion,
  getStorybookInfo,
  temporaryFile,
} from 'storybook/internal/common';

import boxen from 'boxen';
import chalk from 'chalk';
import prompts from 'prompts';
import semver from 'semver';
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
import { FixStatus, allFixes } from './fixes';
import { upgradeStorybookRelatedDependencies } from './fixes/upgrade-storybook-related-dependencies';
import { cleanLog } from './helpers/cleanLog';
import { getMigrationSummary } from './helpers/getMigrationSummary';
import { getStorybookData } from './helpers/mainConfigFile';

const logger = console;
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
  const availableFixes = allFixes
    .map((f) => chalk.yellow(f.id))
    .map((x) => `- ${x}`)
    .join('\n');

  console.log();
  logger.info(dedent`
    The following migrations are available:
    ${availableFixes}
  `);
};

export const doAutomigrate = async (options: AutofixOptionsFromCLI) => {
  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: options.packageManager,
  });

  const [packageJson, storybookVersion] = await Promise.all([
    packageManager.retrievePackageJson(),
    getCoercedStorybookVersion(packageManager),
  ]);

  const { configDir: inferredConfigDir, mainConfig: mainConfigPath } = getStorybookInfo(
    packageJson,
    options.configDir
  );
  const configDir = options.configDir || inferredConfigDir || '.storybook';

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
    configDir,
    isUpgrade: false,
    isLatest: false,
  });

  if (outcome) {
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
  mainConfigPath,
  storybookVersion,
  beforeVersion,
  renderer: rendererPackage,
  skipInstall,
  hideMigrationSummary = false,
  isUpgrade,
  isLatest,
}: AutofixOptions): Promise<{
  fixResults: Record<string, FixStatus>;
  preCheckFailure?: PreCheckFailure;
} | null> => {
  if (list) {
    logAvailableMigrations();
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
    logger.info(`📭 No migrations found for ${chalk.magenta(fixId)}.`);
    logAvailableMigrations();
    return null;
  }

  await augmentLogsToFile();

  logger.info('🔎 checking possible migrations..');

  const { fixResults, fixSummary, preCheckFailure } = await runFixes({
    fixes,
    packageManager,
    rendererPackage,
    skipInstall,
    configDir,
    mainConfigPath,
    storybookVersion,
    beforeVersion,
    isUpgrade: !!isUpgrade,
    dryRun,
    yes,
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

    logger.info();
    logger.info(
      getMigrationSummary({ fixResults, fixSummary, logFile: LOG_FILE_PATH, installationMetadata })
    );
    logger.info();
  }

  cleanup();

  return { fixResults, preCheckFailure };
};

export async function runFixes({
  fixes,
  dryRun,
  yes,
  rendererPackage,
  skipInstall,
  configDir,
  packageManager,
  mainConfigPath,
  storybookVersion,
  beforeVersion,
  isUpgrade,
}: {
  fixes: Fix[];
  yes?: boolean;
  dryRun?: boolean;
  rendererPackage?: string;
  skipInstall?: boolean;
  configDir: string;
  packageManager: JsPackageManager;
  mainConfigPath: string;
  storybookVersion: string;
  beforeVersion: string;
  isUpgrade?: boolean;
}): Promise<{
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
      const { mainConfig, previewConfigPath } = await getStorybookData({
        configDir,
        packageManager,
      });

      if (
        (isUpgrade &&
          semver.satisfies(beforeVersion, f.versionRange[0], { includePrerelease: true }) &&
          semver.satisfies(storybookVersion, f.versionRange[1], { includePrerelease: true })) ||
        !isUpgrade
      ) {
        result = await f.check({
          packageManager,
          configDir,
          rendererPackage,
          mainConfig,
          storybookVersion,
          previewConfigPath,
          mainConfigPath,
        });
      }
    } catch (error) {
      logger.info(`⚠️  failed to check fix ${chalk.bold(f.id)}`);
      if (error instanceof Error) {
        logger.error(`\n${error.stack}`);
        fixSummary.failed[f.id] = error.message;
      }
      fixResults[f.id] = FixStatus.CHECK_FAILED;
    }

    if (result) {
      const promptType: Prompt =
        typeof f.promptType === 'function' ? await f.promptType(result) : (f.promptType ?? 'auto');

      logger.info(`\n🔎 found a '${chalk.cyan(f.id)}' migration:`);
      const message = f.prompt(result);

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

      logger.info(
        boxen(message, {
          borderStyle: 'round',
          padding: 1,
          borderColor: '#F1618C',
          title: getTitle(),
        })
      );

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

          logger.info();
          const { shouldContinue } = await prompts(
            {
              type: 'toggle',
              name: 'shouldContinue',
              message:
                'Select continue once you have made the required changes, or quit to exit the migration process',
              initial: true,
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
          runAnswer = await prompts(
            {
              type: 'confirm',
              name: 'fix',
              message: `Do you want to run the '${chalk.cyan(f.id)}' migration on your project?`,
              initial: f.promptDefaultValue ?? true,
            },
            {
              onCancel: () => {
                throw new Error();
              },
            }
          );
        } else if (promptType === 'notification') {
          runAnswer = await prompts(
            {
              type: 'confirm',
              name: 'fix',
              message: `Do you want to continue?`,
              initial: true,
            },
            {
              onCancel: () => {
                throw new Error();
              },
            }
          );
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
              skipInstall,
            });
            logger.info(`✅ ran ${chalk.cyan(f.id)} migration`);

            fixResults[f.id] = FixStatus.SUCCEEDED;
            fixSummary.succeeded.push(f.id);
          } catch (error) {
            fixResults[f.id] = FixStatus.FAILED;
            fixSummary.failed[f.id] =
              error instanceof Error ? error.message : 'Failed to run migration';

            logger.info(`❌ error when running ${chalk.cyan(f.id)} migration`);
            logger.info(error);
            logger.info();
          }
        } else {
          fixResults[f.id] = FixStatus.SKIPPED;
          fixSummary.skipped.push(f.id);
        }
      }
    } else {
      fixResults[f.id] = fixResults[f.id] || FixStatus.UNNECESSARY;
    }
  }

  return { fixResults, fixSummary };
}
