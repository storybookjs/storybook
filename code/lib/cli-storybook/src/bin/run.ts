import { globalSettings } from 'storybook/internal/cli';
import {
  HandledError,
  JsPackageManagerFactory,
  isCI,
  optionalEnvToBoolean,
  removeAddon as remove,
  versions,
} from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { CLI_COLORS, logTracker, logger, prompt } from 'storybook/internal/node-logger';
import { addToGlobalContext, telemetry } from 'storybook/internal/telemetry';

import { program } from 'commander';
import envinfo from 'envinfo';
import leven from 'leven';
import picocolors from 'picocolors';

import { version } from '../../package.json';
import { add } from '../add';
import { doAutomigrate } from '../automigrate';
import { doctor } from '../doctor';
import { link } from '../link';
import { migrate } from '../migrate';
import { sandbox } from '../sandbox';
import { type UpgradeOptions, upgrade } from '../upgrade';

addToGlobalContext('cliVersion', versions.storybook);

// Return a failed exit code but write the logs to a file first
const handleCommandFailure = async (error: unknown): Promise<never> => {
  if (!(error instanceof HandledError)) {
    logger.error(String(error));
  }

  const logFile = await logTracker.writeToFile();
  logger.log(`Storybook debug logs can be found at: ${logFile}`);
  logger.outro('');
  process.exit(1);
};

const command = (name: string) =>
  program
    .command(name)
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
    )
    .option('--debug', 'Get more logs in debug mode', false)
    .option('--enable-crash-reports', 'Enable sending crash reports to telemetry data')
    .option('--write-logs', 'Write all debug logs to a file at the end of the run')
    .option('--loglevel <trace | debug | info | warn | error | silent>', 'Define log level', 'info')
    .hook('preAction', async (self) => {
      const options = self.opts();
      if (options.debug) {
        logger.setLogLevel('debug');
      }

      if (options.loglevel) {
        logger.setLogLevel(options.loglevel);
      }

      if (options.writeLogs) {
        logTracker.enableLogWriting();
      }

      try {
        await globalSettings();
      } catch (e) {
        logger.error('Error loading global settings:\n' + String(e));
      }
    })
    .hook('postAction', async () => {
      if (logTracker.shouldWriteLogsToFile) {
        const logFile = await logTracker.writeToFile();
        logger.log(`Storybook debug logs can be found at: ${logFile}`);
        logger.outro(CLI_COLORS.success('Done!'));
      }
    });

command('init')
  .description('Initialize Storybook into your project')
  .option('-f --force', 'Force add Storybook')
  .option('-s --skip-install', 'Skip installing deps')
  .option('--package-manager <npm|pnpm|yarn1|yarn2>', 'Force package manager for installing deps')
  // TODO: Remove in SB11
  .option('--use-pnp', 'Enable PnP mode for Yarn 2+')
  .option('-p --parser <babel | babylon | flow | ts | tsx>', 'jscodeshift parser')
  .option('-t --type <type>', 'Add Storybook for a specific project type')
  .option('-y --yes', 'Answer yes to all prompts')
  .option('-b --builder <webpack5 | vite>', 'Builder library')
  .option('-l --linkable', 'Prepare installation for link (contributor helper)')
  .option(
    '--dev',
    'Launch the development server after completing initialization. Enabled by default (default: true)',
    !isCI() && !optionalEnvToBoolean(process.env.IN_STORYBOOK_SANDBOX)
  )
  .option(
    '--no-dev',
    'Complete the initialization of Storybook without launching the Storybook development server'
  );

command('add <addon>')
  .description('Add an addon to your Storybook')
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2|bun>',
    'Force package manager for installing dependencies'
  )
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option('--skip-install', 'Skip installing deps')
  .option('-s --skip-postinstall', 'Skip package specific postinstall config modifications')
  .option('-y --yes', 'Skip prompting the user')
  .option('--skip-doctor', 'Skip doctor check')
  .action((addonName: string, options: any) => {
    withTelemetry('add', { cliOptions: options }, async () => {
      logger.intro(`Setting up your project for ${addonName}`);

      await add(addonName, options);

      if (!options.disableTelemetry) {
        await telemetry('add', { addon: addonName, source: 'cli' });
      }
    }).catch(handleCommandFailure);
  });

command('remove <addon>')
  .description('Remove an addon from your Storybook')
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2|bun>',
    'Force package manager for installing dependencies'
  )
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option('-s --skip-install', 'Skip installing deps')
  .action((addonName: string, options: any) =>
    withTelemetry('remove', { cliOptions: options }, async () => {
      const packageManager = JsPackageManagerFactory.getPackageManager({
        configDir: options.configDir,
        force: options.packageManager,
      });
      await remove(addonName, {
        configDir: options.configDir,
        packageManager,
        skipInstall: options.skipInstall,
      });
      if (!options.disableTelemetry) {
        await telemetry('remove', { addon: addonName, source: 'cli' });
      }
    })
  );

command('upgrade')
  .description(`Upgrade your Storybook packages to v${versions.storybook}`)
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2|bun>',
    'Force package manager for installing dependencies'
  )
  .option('-y --yes', 'Skip prompting the user')
  .option('-f --force', 'force the upgrade, skipping autoblockers')
  .option('-n --dry-run', 'Only check for upgrades, do not install')
  .option('-s --skip-check', 'Skip postinstall version and automigration checks')
  .option(
    '-c, --config-dir <dir-name...>',
    'Directory(ies) where to load Storybook configurations from'
  )
  .action(async (options: UpgradeOptions) => {
    await upgrade(options).catch(handleCommandFailure);
  });

command('info')
  .description('Prints debugging information about the local environment')
  .action(async () => {
    logger.log(picocolors.bold('\nStorybook Environment Info:'));
    const pkgManager = JsPackageManagerFactory.getPackageManager();
    const activePackageManager = pkgManager.type.replace(/\d/, ''); // 'yarn1' -> 'yarn'
    const output = await envinfo.run({
      System: ['OS', 'CPU', 'Shell'],
      Binaries: ['Node', 'Yarn', 'npm', 'pnpm'],
      Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
      npmPackages: '{@storybook/*,*storybook*,sb,chromatic}',
      npmGlobalPackages: '{@storybook/*,*storybook*,sb,chromatic}',
    });
    const activePackageManagerLine = output.match(new RegExp(`${activePackageManager}:.*`, 'i'));
    logger.log(
      output.replace(
        activePackageManagerLine,
        picocolors.bold(`${activePackageManagerLine} <----- active`)
      )
    );
  });

command('migrate [migration]')
  .description('Run a Storybook codemod migration on your source files')
  .option('-l --list', 'List available migrations')
  .option('-g --glob <glob>', 'Glob for files upon which to apply the migration', '**/*.js')
  .option('-p --parser <babel | babylon | flow | ts | tsx>', 'jscodeshift parser')
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option(
    '-n --dry-run',
    'Dry run: verify the migration exists and show the files to which it will be applied'
  )
  .option(
    '-r --rename <from-to>',
    'Rename suffix of matching files after codemod has been applied, e.g. ".js:.ts"'
  )
  .action((migration, options) => {
    withTelemetry('migrate', { cliOptions: options }, async () => {
      logger.intro(`Running ${migration} migration`);
      await migrate(migration, options);
      logger.outro('Migration completed');
    }).catch(handleCommandFailure);
  });

command('sandbox [filterValue]')
  .alias('repro') // for backwards compatibility
  .description('Create a sandbox from a set of possible templates')
  .option('-o --output <outDir>', 'Define an output directory')
  .option('--no-init', 'Whether to download a template without an initialized Storybook', false)
  .action((filterValue, options) => {
    logger.intro(`Creating a Storybook sandbox...`);
    sandbox({ filterValue, ...options })
      .catch(handleCommandFailure)
      .finally(() => {
        logger.outro('Done!');
      });
  });

command('link <repo-url-or-directory>')
  .description('Pull down a repro from a URL (or a local directory), link it, and run storybook')
  .option('--local', 'Link a local directory already in your file system')
  .option('--no-start', 'Start the storybook', true)
  .action((target, { local, start }) => link({ target, local, start }).catch(handleCommandFailure));

command('automigrate [fixId]')
  .description('Check storybook for incompatibilities or migrations and apply fixes')
  .option('-y --yes', 'Skip prompting the user')
  .option('-n --dry-run', 'Only check for fixes, do not actually run them')
  .option('--package-manager <npm|pnpm|yarn1|yarn2|bun>', 'Force package manager')
  .option('-l --list', 'List available migrations')
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configurations to migrate')
  .option('-s --skip-install', 'Skip installing deps')
  .option(
    '--renderer <renderer-pkg-name>',
    'The renderer package for the framework Storybook is using.'
  )
  .option('--skip-doctor', 'Skip doctor check')
  .action(async (fixId, options) => {
    withTelemetry('automigrate', { cliOptions: options }, async () => {
      logger.intro(`Running ${fixId} automigration`);
      await doAutomigrate({ fixId, ...options });
      logger.outro('Done');
    }).catch(handleCommandFailure);
  });

command('doctor')
  .description('Check Storybook for known problems and provide suggestions or fixes')
  .option('--package-manager <npm|pnpm|yarn1|yarn2|bun>', 'Force package manager')
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configuration')
  .action(async (options) => {
    // TODO: Add telemetry
    await doctor(options).catch(handleCommandFailure);
  });

program.on('command:*', ([invalidCmd]) => {
  let errorMessage = ` Invalid command: ${picocolors.bold(invalidCmd)}.\n See --help for a list of available commands.`;
  const availableCommands = program.commands.map((cmd) => cmd.name());
  const suggestion = availableCommands.find((cmd) => leven(cmd, invalidCmd) < 3);
  if (suggestion) {
    errorMessage += `\n Did you mean ${picocolors.yellow(suggestion)}?`;
  }
  logger.error(errorMessage);
  process.exit(1);
});

program.usage('<command> [options]').version(String(version)).parse(process.argv);
