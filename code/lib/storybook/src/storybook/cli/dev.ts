import { cache } from '@storybook/core/internal/common';
import {
  buildDevStandalone,
  exitOnDevServerSignal,
  withTelemetry,
} from 'storybook/internal/server';
import { logger, instance as npmLog } from '@storybook/core/internal/node-logger';
import type { CLIOptions } from '@storybook/core/internal/types';

import { dedent } from '@storybook/core/internal/deep/utils/node-libs';

function printError(error: any) {
  // this is a weird bugfix, somehow 'node-pre-gyp' is polluting the npmLog header
  npmLog.heading = '';

  if (error instanceof Error) {
    if ((error as any).error) {
      logger.error((error as any).error);
    } else if ((error as any).stats && (error as any).stats.compilation.errors) {
      (error as any).stats.compilation.errors.forEach((e: any) => logger.log(e));
    } else {
      logger.error(error as any);
    }
  } else if (error.compilation?.errors) {
    error.compilation.errors.forEach((e: any) => logger.log(e));
  }

  logger.warn(
    error.close
      ? dedent`
          FATAL broken build!, will close the process,
          Fix the error below and restart storybook.
        `
      : dedent`
          Broken build, fix the error above.
          You may need to refresh the browser.
        `
  );
}

export const dev = async (cliOptions: CLIOptions): Promise<void> => {
  const { env } = process;
  env.NODE_ENV = env.NODE_ENV || 'development';

  const { default: packageJson } = await import('storybook/package.json', {
    with: { type: 'json' },
  });
  type Options = Parameters<typeof buildDevStandalone>[0];

  const options = {
    ...cliOptions,
    configDir: cliOptions.configDir || './.storybook',
    configType: 'DEVELOPMENT',
    cache: cache as any,
    packageJson: packageJson,
  } as Options;

  const result = await withTelemetry(
    'dev',
    {
      cliOptions,
      presetOptions: options as Parameters<typeof withTelemetry>[1]['presetOptions'],
      printError,
    },
    () => buildDevStandalone(options)
  );
  if (!result) {
    return;
  }
  if (result.exitCode !== undefined) {
    process.exit(result.exitCode);
  }
  exitOnDevServerSignal(result);
};
