import { getEnvConfig, optionalEnvToBoolean, parseList } from 'storybook/internal/common';
import { logTracker, logger } from 'storybook/internal/node-logger';
import { addToGlobalContext } from 'storybook/internal/telemetry';

import { program } from 'commander';
import { findPackage } from 'fd-package-json';
import leven from 'leven';
import picocolors from 'picocolors';
import invariant from 'tiny-invariant';

import { version } from '../../../package.json';
import { build } from '../build';
import { buildIndex as index } from '../buildIndex';
import { dev } from '../dev';
import { globalSettings } from '../globalSettings';

addToGlobalContext('cliVersion', version);

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
    .option('--loglevel <trace | debug | info | warn | error | silent>', 'Define log level', 'info')
    .option('--write-logs', 'Write all debug logs to a file at the end of the run')
    .hook('preAction', async (self) => {
      try {
        const options = self.opts();
        if (options.loglevel) {
          logger.setLogLevel(options.loglevel);
        }

        if (options.writeLogs) {
          logTracker.enableLogWriting();
        }

        await globalSettings();
      } catch (e) {
        logger.error('Error loading global settings:\n' + String(e));
      }
    })
    .hook('postAction', async () => {
      if (logTracker.shouldWriteLogsToFile) {
        const logFile = await logTracker.writeToFile();
        logger.outro(`Storybook debug logs can be found at: ${logFile}`);
      }
    });

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
  .option('--preview-only', 'Use the preview without the manager UI')
  .action(async (options) => {
    const pkg = await findPackage(__dirname);
    invariant(pkg, 'Failed to find the closest package.json file.');

    logger.log(picocolors.bold(`${pkg.name} v${pkg.version}`) + picocolors.reset('\n'));

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
  .option('--preview-only', 'Use the preview without the manager UI')
  .action(async (options) => {
    const { env } = process;
    env.NODE_ENV = env.NODE_ENV || 'production';

    const pkg = await findPackage(__dirname);
    invariant(pkg, 'Failed to find the closest package.json file.');

    logger.log(picocolors.bold(`${pkg.name} v${pkg.version}\n`));

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
      test: !!options.test || optionalEnvToBoolean(process.env.SB_TESTBUILD),
    }).catch(() => process.exit(1));
  });

command('index')
  .option('-o, --output-file <file-name>', 'JSON file to output index')
  .option('-c, --config-dir <dir-name>', 'Directory where to load Storybook configurations from')
  .option('--quiet', 'Suppress verbose build output')
  .action(async (options) => {
    const { env } = process;
    env.NODE_ENV = env.NODE_ENV || 'production';

    const pkg = await findPackage(__dirname);
    invariant(pkg, 'Failed to find the closest package.json file.');

    logger.log(picocolors.bold(`${pkg.name} v${pkg.version}\n`));

    // The key is the field created in `options` variable for
    // each command line argument. Value is the env variable.
    getEnvConfig(options, {
      configDir: 'SBCONFIG_CONFIG_DIR',
      outputFile: 'SBCONFIG_OUTPUT_FILE',
    });

    await index({
      ...options,
      packageJson: pkg,
    }).catch(() => process.exit(1));
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
