import { ProjectType } from 'storybook/internal/cli';
import { PackageManagerName, isCI, optionalEnvToBoolean } from 'storybook/internal/common';
import { logTracker, logger } from 'storybook/internal/node-logger';
import { addToGlobalContext } from 'storybook/internal/telemetry';
import { Feature, SupportedBuilder } from 'storybook/internal/types';

import { Option, program } from 'commander';

import { version } from '../../package.json';
import type { CommandOptions } from '../generators/types';
import { initiate } from '../initiate';

addToGlobalContext('cliVersion', version);

/**
 * Create a commander application with flags for both legacy and modern. We then check the options
 * given by commander with zod. If zod validates the options, we run the modern version of the app.
 * If zod fails to validate the options, we check why, and if it's because of a legacy flag, we run
 * the legacy version of the app.
 */
const createStorybookProgram = program
  .name('Initialize Storybook into your project.')
  .option(
    '--disable-telemetry',
    'Disable sending telemetry data',
    optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
  )
  .addOption(
    new Option('--features <list...>', 'Storybook features')
      .choices(Object.values(Feature))
      .default(undefined)
  )
  .option('--no-features', 'Disable all features (overrides --features)')
  .option('--debug', 'Get more logs in debug mode')
  .option('--enable-crash-reports', 'Enable sending crash reports to telemetry data')
  .option('-f --force', 'Force add Storybook')
  .option('-s --skip-install', 'Skip installing deps')
  .addOption(
    new Option('--package-manager <type>', 'Force package manager for installing deps').choices(
      Object.values(PackageManagerName)
    )
  )
  // TODO: Remove in SB11
  .option('--use-pnp', 'Enable pnp mode for Yarn 2+')
  .addOption(
    new Option('--parser <type>', 'jscodeshift parser').choices([
      'babel',
      'babylon',
      'flow',
      'ts',
      'tsx',
    ])
  )
  .addOption(
    new Option('--type <type>', 'Add Storybook for a specific project type').choices(
      Object.values(ProjectType).filter(
        (type) => ![ProjectType.UNDETECTED, ProjectType.UNSUPPORTED, ProjectType.NX].includes(type)
      )
    )
  )
  .option('-y --yes', 'Answer yes to all prompts')
  .addOption(
    new Option('--builder <type>', 'Builder library').choices(Object.values(SupportedBuilder))
  )
  .option('-l --linkable', 'Prepare installation for link (contributor helper)')
  // due to how Commander handles default values and negated options, we have to elevate the default into Commander, and we have to specify `--dev`
  // alongside `--no-dev` even if we are unlikely to directly use `--dev`. https://github.com/tj/commander.js/issues/2068#issuecomment-1804524585
  .option(
    '--dev',
    'Launch the development server after completing initialization. Enabled by default'
  )
  .option(
    '--no-dev',
    'Complete the initialization of Storybook without launching the Storybook development server'
  )
  .option(
    '--logfile [path]',
    'Write all debug logs to the specified file at the end of the run. Defaults to debug-storybook.log when [path] is not provided'
  )
  .addOption(
    new Option('--loglevel <level>', 'Define log level').choices([
      'trace',
      'debug',
      'info',
      'warn',
      'error',
      'silent',
    ])
  )
  .hook('preAction', async (self) => {
    const options = self.opts();

    if (options.debug) {
      logger.setLogLevel('debug');
    }

    if (options.loglevel) {
      logger.setLogLevel(options.loglevel);
    }

    if (options.logfile) {
      logTracker.enableLogWriting();
    }
  })
  .hook('postAction', async (command) => {
    if (logTracker.shouldWriteLogsToFile) {
      await logTracker.writeToFile(command.getOptionValue('logfile'));
    }
  });

createStorybookProgram
  .action(async (options) => {
    const isNeitherCiNorSandbox =
      !isCI() && !optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX);
    options.debug = options.debug ?? false;
    options.dev = options.dev ?? isNeitherCiNorSandbox;

    if (options.features === false) {
      // Ensure features are treated as empty when --no-features is set
      options.features = [];
    }

    await initiate(options as CommandOptions).catch(() => process.exit(1));
  })
  .version(String(version))
  .parse(process.argv);
