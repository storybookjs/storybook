import { cache } from 'storybook/internal/common';
import { buildDevStandalone, withTelemetry } from 'storybook/internal/core-server';
import { logTracker, logger, instance as npmLog } from 'storybook/internal/node-logger';
import type { CLIOptions, PackageJson } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

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
    ignorePreview: !!cliOptions.previewUrl && !cliOptions.forceBuildPreview,
    cache: cache as any,
    packageJson: packageJson as unknown as PackageJson, // type-fest types are wrong here because we're on an outdated version of the package
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
