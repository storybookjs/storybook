import { optionalEnvToBoolean } from 'storybook/internal/common';
import { logTracker, logger, type LogLevel } from 'storybook/internal/node-logger';

import { Option, type Command } from 'commander';

import { globalSettings } from '../cli/globalSettings.ts';

const CLI_LOG_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'silent'] as const;

// Agent-facing commands pass `silent` so logger chatter cannot mix into parseable stdout.
export function addSharedCliOptions(command: Command, defaultLogLevel: LogLevel = 'info'): Command {
  return command
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
    )
    .option('--debug', 'Get more logs in debug mode', false)
    .option('--enable-crash-reports', 'Enable sending crash reports to telemetry data')
    .addOption(
      new Option('--loglevel <level>', 'Define log level')
        .choices([...CLI_LOG_LEVELS])
        .default(defaultLogLevel)
    )
    .option(
      '--logfile [path]',
      'Write all debug logs to the specified file at the end of the run. Defaults to debug-storybook.log when [path] is not provided'
    )
    .hook('preAction', async (self) => {
      try {
        const options = self.opts();
        const loglevel = options.debug ? 'debug' : options.loglevel;
        logger.setLogLevel(loglevel);

        if (options.logfile) {
          logTracker.enableLogWriting();
        }

        await globalSettings();
      } catch (e) {
        logger.error('Error loading global settings:\n' + String(e));
      }
    });
}
