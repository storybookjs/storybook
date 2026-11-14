import { cache } from 'storybook/internal/common';
import { buildDevStandalone, withTelemetry } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { NoFreePortError } from 'storybook/internal/server-errors';
import type { CLIOptions, PackageJson } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

function printError(error: any) {
  // The environment refused every port: the message says why and what to do. A stack trace and
  // "fix the error above" would point at code that is not at fault.
  if (error instanceof NoFreePortError) {
    logger.error(`${error.name}: ${error.message}`);
    return;
  }
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

export const dev = async (cliOptions: CLIOptions) => {
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

  await withTelemetry(
    'dev',
    {
      cliOptions,
      presetOptions: options as Parameters<typeof withTelemetry>[1]['presetOptions'],
      printError,
    },
    () => buildDevStandalone(options)
  );
};
