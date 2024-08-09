import {
  JsPackageManagerFactory,
  removeAddon as remove,
  versions,
} from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { addToGlobalContext, telemetry } from 'storybook/internal/telemetry';

import chalk from 'chalk';
import program from 'commander';
import envinfo from 'envinfo';
import { findPackageSync } from 'fd-package-json';
import leven from 'leven';
import invariant from 'tiny-invariant';

import { add } from '../add';
import { doAutomigrate } from '../automigrate';
import { doctor } from '../doctor';
import { link } from '../link';
import { migrate } from '../migrate';
import { sandbox } from '../sandbox';
import { type UpgradeOptions, upgrade } from '../upgrade';

addToGlobalContext('cliVersion', versions.storybook);

const pkg = findPackageSync(__dirname);
invariant(pkg, 'Failed to find the closest package.json file.');
const consoleLogger = console;

const command = (name: string) =>
  program
    .command(name)
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      // default value is false, but if the user sets STORYBOOK_DISABLE_TELEMETRY, it can be true
      process.env.STORYBOOK_DISABLE_TELEMETRY && process.env.STORYBOOK_DISABLE_TELEMETRY !== 'false'
    )
    .option('--debug', 'Get more logs in debug mode', false)
    .option('--enable-crash-reports', 'Enable sending crash reports to telemetry data');

command('add <addon>')
  .description('Add an addon to your Storybook')
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2>',
    'Force package manager for installing dependencies'
  )
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option('-s --skip-postinstall', 'Skip package specific postinstall config modifications')
  .action((addonName: string, options: any) => add(addonName, options));

command('remove <addon>')
  .description('Remove an addon from your Storybook')
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2>',
    'Force package manager for installing dependencies'
  )
  .action((addonName: string, options: any) =>
    withTelemetry('remove', { cliOptions: options }, async () => {
      await remove(addonName, options);
      if (!options.disableTelemetry) {
        await telemetry('remove', { addon: addonName, source: 'cli' });
      }
    })
  );

command('upgrade')
  .description(`Upgrade your Storybook packages to v${versions.storybook}`)
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2>',
    'Force package manager for installing dependencies'
  )
  .option('-y --yes', 'Skip prompting the user')
  .option('-f --force', 'force the upgrade, skipping autoblockers')
  .option('-n --dry-run', 'Only check for upgrades, do not install')
  .option('-s --skip-check', 'Skip postinstall version and automigration checks')
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .action(async (options: UpgradeOptions) => upgrade(options).catch(() => process.exit(1)));

command('info')
  .description('Prints debugging information about the local environment')
  .action(async () => {
    consoleLogger.log(chalk.bold('\nStorybook Environment Info:'));
    const pkgManager = await JsPackageManagerFactory.getPackageManager();
    const activePackageManager = pkgManager.type.replace(/\d/, ''); // 'yarn1' -> 'yarn'
    const output = await envinfo.run({
      System: ['OS', 'CPU', 'Shell'],
      Binaries: ['Node', 'Yarn', 'npm', 'pnpm'],
      Browsers: ['Chrome', 'Edge', 'Firefox', 'Safari'],
      npmPackages: '{@storybook/*,*storybook*,sb,chromatic}',
      npmGlobalPackages: '{@storybook/*,*storybook*,sb,chromatic}',
    });
    const activePackageManagerLine = output.match(new RegExp(`${activePackageManager}:.*`, 'i'));
    consoleLogger.log(
      output.replace(
        activePackageManagerLine,
        chalk.bold(`${activePackageManagerLine} <----- active`)
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
  .action((migration, { configDir, glob, dryRun, list, rename, parser }) => {
    migrate(migration, {
      configDir,
      glob,
      dryRun,
      list,
      rename,
      parser,
    }).catch((err) => {
      logger.error(err);
      process.exit(1);
    });
  });

command('sandbox [filterValue]')
  .alias('repro') // for backwards compatibility
  .description('Create a sandbox from a set of possible templates')
  .option('-o --output <outDir>', 'Define an output directory')
  .option('--no-init', 'Whether to download a template without an initialized Storybook', false)
  .action((filterValue, options) =>
    sandbox({ filterValue, ...options }).catch((e) => {
      logger.error(e);
      process.exit(1);
    })
  );

command('link <repo-url-or-directory>')
  .description('Pull down a repro from a URL (or a local directory), link it, and run storybook')
  .option('--local', 'Link a local directory already in your file system')
  .option('--no-start', 'Start the storybook', true)
  .action((target, { local, start }) =>
    link({ target, local, start }).catch((e) => {
      logger.error(e);
      process.exit(1);
    })
  );

command('automigrate [fixId]')
  .description('Check storybook for incompatibilities or migrations and apply fixes')
  .option('-y --yes', 'Skip prompting the user')
  .option('-n --dry-run', 'Only check for fixes, do not actually run them')
  .option('--package-manager <npm|pnpm|yarn1|yarn2>', 'Force package manager')
  .option('-l --list', 'List available migrations')
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configurations to migrate')
  .option('-s --skip-install', 'Skip installing deps')
  .option(
    '--renderer <renderer-pkg-name>',
    'The renderer package for the framework Storybook is using.'
  )
  .action(async (fixId, options) => {
    await doAutomigrate({ fixId, ...options }).catch((e) => {
      logger.error(e);
      process.exit(1);
    });
  });

command('doctor')
  .description('Check Storybook for known problems and provide suggestions or fixes')
  .option('--package-manager <npm|pnpm|yarn1|yarn2>', 'Force package manager')
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configuration')
  .action(async (options) => {
    await doctor(options).catch((e) => {
      logger.error(e);
      process.exit(1);
    });
  });

program.on('command:*', ([invalidCmd]) => {
  consoleLogger.error(
    ' Invalid command: %s.\n See --help for a list of available commands.',
    invalidCmd
  );
  // eslint-disable-next-line no-underscore-dangle
  const availableCommands = program.commands.map((cmd) => cmd._name);
  const suggestion = availableCommands.find((cmd) => leven(cmd, invalidCmd) < 3);
  if (suggestion) {
    consoleLogger.info(`\n Did you mean ${suggestion}?`);
  }
  process.exit(1);
});

program.usage('<command> [options]').version(String(pkg.version)).parse(process.argv);
