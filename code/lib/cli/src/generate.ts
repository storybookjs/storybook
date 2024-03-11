import program from 'commander';
import path from 'path';
import chalk from 'chalk';
import envinfo from 'envinfo';
import leven from 'leven';
import { sync as readUpSync } from 'read-pkg-up';

import { logger } from '@storybook/node-logger';
import { addToGlobalContext } from '@storybook/telemetry';

import type { CommandOptions } from './generators/types';
import { initiate } from './initiate';
import { add } from './add';
import { migrate } from './migrate';
import { extract } from './extract';
import { upgrade, type UpgradeOptions } from './upgrade';
import { sandbox } from './sandbox';
import { link } from './link';
import { automigrate } from './automigrate';
import { generateStorybookBabelConfigInCWD } from './babel-config';
import { dev } from './dev';
import { build } from './build';
import { parseList, getEnvConfig } from './utils';
import versions from './versions';
import { JsPackageManagerFactory } from './js-package-manager';
import { doctor } from './doctor';

addToGlobalContext('cliVersion', versions.storybook);

const pkg = readUpSync({ cwd: __dirname }).packageJson;
const consoleLogger = console;

const command = (name: string) =>
  program
    .command(name)
    .option(
      '--disable-telemetry',
      'disable sending telemetry data',
      // default value is false, but if the user sets STORYBOOK_DISABLE_TELEMETRY, it can be true
      process.env.STORYBOOK_DISABLE_TELEMETRY && process.env.STORYBOOK_DISABLE_TELEMETRY !== 'false'
    )
    .option('--debug', 'Get more logs in debug mode', false)
    .option('--enable-crash-reports', 'enable sending crash reports to telemetry data');

command('init')
  .description('Initialize Storybook into your project.')
  .option('-f --force', 'Force add Storybook')
  .option('-s --skip-install', 'Skip installing deps')
  .option('--package-manager <npm|pnpm|yarn1|yarn2>', 'Force package manager for installing deps')
  .option('-N --use-npm', 'Use npm to install deps (deprecated)')
  .option('--use-pnp', 'Enable pnp mode for Yarn 2+')
  .option('-p --parser <babel | babylon | flow | ts | tsx>', 'jscodeshift parser')
  .option('-t --type <type>', 'Add Storybook for a specific project type')
  .option('-y --yes', 'Answer yes to all prompts')
  .option('-b --builder <webpack5 | vite>', 'Builder library')
  .option('-l --linkable', 'Prepare installation for link (contributor helper)')
  .action((options: CommandOptions) => {
    initiate(options, pkg).catch(() => process.exit(1));
  });

command('add <addon>')
  .description('Add an addon to your Storybook')
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2>',
    'Force package manager for installing dependencies'
  )
  .option('-N --use-npm', 'Use NPM to install dependencies (deprecated)')
  .option('-s --skip-postinstall', 'Skip package specific postinstall config modifications')
  .action((addonName: string, options: any) => add(addonName, options));

command('babelrc')
  .description('generate the default storybook babel config into your current working directory')
  .action(() => generateStorybookBabelConfigInCWD());

command('upgrade')
  .description(`Upgrade your Storybook packages to v${versions.storybook}`)
  .option(
    '--package-manager <npm|pnpm|yarn1|yarn2>',
    'Force package manager for installing dependencies'
  )
  .option('-N --use-npm', 'Use NPM to install dependencies (deprecated)')
  .option('-y --yes', 'Skip prompting the user')
  .option('-n --dry-run', 'Only check for upgrades, do not install')
  .option(
    '-t --tag <tag>',
    'Upgrade to a certain npm dist-tag (e.g. next, prerelease) (deprecated)'
  )
  .option('-p --prerelease', 'Upgrade to the pre-release packages (deprecated)')
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
      logger: consoleLogger,
    }).catch((err) => {
      logger.error(err);
      process.exit(1);
    });
  });

command('extract [location] [output]')
  .description('extract stories.json from a built version')
  .action((location = 'storybook-static', output = path.join(location, 'stories.json')) =>
    extract(location, output).catch((e) => {
      logger.error(e);
      process.exit(1);
    })
  );

command('sandbox [filterValue]')
  .alias('repro') // for backwards compatibility
  .description('Create a sandbox from a set of possible templates')
  .option('-o --output <outDir>', 'Define an output directory')
  .option('-b --branch <branch>', 'Define the branch to download from', 'next')
  .option('--no-init', 'Whether to download a template without an initialized Storybook', false)
  .action((filterValue, options) =>
    sandbox({ filterValue, ...options }, pkg).catch((e) => {
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
  .option('-N --use-npm', 'Use npm as package manager (deprecated)')
  .option('-l --list', 'List available migrations')
  .option('-c, --config-dir <dir-name>', 'Directory of Storybook configurations to migrate')
  .option('-s --skip-install', 'Skip installing deps')
  .option(
    '--renderer <renderer-pkg-name>',
    'The renderer package for the framework Storybook is using.'
  )
  .action(async (fixId, options) => {
    await automigrate({ fixId, ...options }).catch((e) => {
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

command('dev')
  .option('-p, --port <number>', 'Port to run Storybook', (str) => parseInt(str, 10))
  .option('-h, --host <string>', 'Host to run Storybook')
  .option('-s, --static-dir <dir-names>', 'Directory where to load static files from', parseList)
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option(
    '--https',
    'Serve Storybook over HTTPS. Note: You must provide your own certificate information.'
  )
  .option(
    '--ssl-ca <ca>',
    'Provide an SSL certificate authority. (Optional with --https, required if using a self-signed certificate)',
    parseList
  )
  .option('--ssl-cert <cert>', 'Provide an SSL certificate. (Required with --https)')
  .option('--ssl-key <key>', 'Provide an SSL key. (Required with --https)')
  .option('--smoke-test', 'Exit after successful start')
  .option('--ci', "CI mode (skip interactive prompts, don't open browser)")
  .option('--no-open', 'Do not open Storybook automatically in the browser')
  .option('--loglevel <level>', 'Control level of logging during build')
  .option('--quiet', 'Suppress verbose build output')
  .option('--no-version-updates', 'Suppress update check', true)
  .option('--debug-webpack', 'Display final webpack configurations for debugging purposes')
  .option('--webpack-stats-json [directory]', 'Write Webpack Stats JSON to disk')
  .option(
    '--preview-url <string>',
    'Disables the default storybook preview and lets your use your own'
  )
  .option('--force-build-preview', 'Build the preview iframe even if you are using --preview-url')
  .option('--docs', 'Build a documentation-only site using addon-docs')
  .option(
    '--initial-path [path]',
    'URL path to be appended when visiting Storybook for the first time'
  )
  .action(async (options) => {
    logger.setLevel(program.loglevel);
    consoleLogger.log(chalk.bold(`${pkg.name} v${pkg.version}`) + chalk.reset('\n'));

    // The key is the field created in `options` variable for
    // each command line argument. Value is the env variable.
    getEnvConfig(options, {
      port: 'SBCONFIG_PORT',
      host: 'SBCONFIG_HOSTNAME',
      staticDir: 'SBCONFIG_STATIC_DIR',
      configDir: 'SBCONFIG_CONFIG_DIR',
      ci: 'CI',
    });

    if (parseInt(`${options.port}`, 10)) {
      // eslint-disable-next-line no-param-reassign
      options.port = parseInt(`${options.port}`, 10);
    }

    await dev({ ...options, packageJson: pkg }).catch(() => process.exit(1));
  });

command('build')
  .option('-s, --static-dir <dir-names>', 'Directory where to load static files from', parseList)
  .option('-o, --output-dir <dir-name>', 'Directory where to store built files')
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option('--quiet', 'Suppress verbose build output')
  .option('--loglevel <level>', 'Control level of logging during build')
  .option('--debug-webpack', 'Display final webpack configurations for debugging purposes')
  .option('--webpack-stats-json [directory]', 'Write Webpack Stats JSON to disk')
  .option(
    '--preview-url <string>',
    'Disables the default storybook preview and lets your use your own'
  )
  .option('--force-build-preview', 'Build the preview iframe even if you are using --preview-url')
  .option('--docs', 'Build a documentation-only site using addon-docs')
  .option('--test', 'Build stories optimized for testing purposes.')
  .action(async (options) => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    logger.setLevel(program.loglevel);
    consoleLogger.log(chalk.bold(`${pkg.name} v${pkg.version}\n`));

    // The key is the field created in `options` variable for
    // each command line argument. Value is the env variable.
    getEnvConfig(options, {
      staticDir: 'SBCONFIG_STATIC_DIR',
      outputDir: 'SBCONFIG_OUTPUT_DIR',
      configDir: 'SBCONFIG_CONFIG_DIR',
    });

    await build({
      ...options,
      packageJson: pkg,
      test: !!options.test || process.env.SB_TESTBUILD === 'true',
    }).catch(() => process.exit(1));
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

program.usage('<command> [options]').version(pkg.version).parse(process.argv);
