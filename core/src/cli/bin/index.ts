import { getEnvConfig, parseList, versions } from '@storybook/core/common';
import { addToGlobalContext } from '@storybook/core/telemetry';

import { logger } from '@storybook/core/node-logger';

import { program } from 'commander';
import { findPackageSync } from 'fd-package-json';
import leven from 'leven';
import picocolors from 'picocolors';
import invariant from 'tiny-invariant';

import { build } from '../build';
import { dev } from '../dev';

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

command('dev')
  .option('-p, --port <number>', 'Port to run Storybook', (str) => parseInt(str, 10))
  .option('-h, --host <string>', 'Host to run Storybook')
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
  .option(
    '--webpack-stats-json [directory]',
    'Write Webpack stats JSON to disk (synonym for `--stats-json`)'
  )
  .option('--stats-json [directory]', 'Write stats JSON to disk')
  .option(
    '--preview-url <string>',
    'Disables the default storybook preview and lets your use your own'
  )
  .option('--force-build-preview', 'Build the preview iframe even if you are using --preview-url')
  .option('--docs', 'Build a documentation-only site using addon-docs')
  .option('--exact-port', 'Exit early if the desired port is not available')
  .option(
    '--initial-path [path]',
    'URL path to be appended when visiting Storybook for the first time'
  )
  .action(async (options) => {
    logger.setLevel(options.loglevel);
    consoleLogger.log(picocolors.bold(`${pkg.name} v${pkg.version}`) + picocolors.reset('\n'));

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
      options.port = parseInt(`${options.port}`, 10);
    }

    await dev({ ...options, packageJson: pkg }).catch(() => process.exit(1));
  });

command('build')
  .option('-o, --output-dir <dir-name>', 'Directory where to store built files')
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option('--quiet', 'Suppress verbose build output')
  .option('--loglevel <level>', 'Control level of logging during build')
  .option('--debug-webpack', 'Display final webpack configurations for debugging purposes')
  .option(
    '--webpack-stats-json [directory]',
    'Write Webpack stats JSON to disk (synonym for `--stats-json`)'
  )
  .option('--stats-json [directory]', 'Write stats JSON to disk')
  .option(
    '--preview-url <string>',
    'Disables the default storybook preview and lets your use your own'
  )
  .option('--force-build-preview', 'Build the preview iframe even if you are using --preview-url')
  .option('--docs', 'Build a documentation-only site using addon-docs')
  .option('--test', 'Build stories optimized for testing purposes.')
  .action(async (options) => {
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    logger.setLevel(options.loglevel);
    consoleLogger.log(picocolors.bold(`${pkg.name} v${pkg.version}\n`));

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
  const availableCommands = program.commands.map((cmd) => cmd.name());
  const suggestion = availableCommands.find((cmd) => leven(cmd, invalidCmd) < 3);
  if (suggestion) {
    consoleLogger.info(`\n Did you mean ${suggestion}?`);
  }
  process.exit(1);
});

program.usage('<command> [options]').version(String(pkg.version)).parse(process.argv);
