import { logger } from 'storybook/internal/node-logger';
import { AngularLegacyBuildOptionsError } from 'storybook/internal/server-errors';

import { BuilderContext, targetFromTargetString } from '@angular-devkit/architect';
import { JsonObject, logging } from '@angular-devkit/core';
import { sync as findUpSync } from 'find-up';
import webpack from 'webpack';

import { getWebpackConfig as getCustomWebpackConfig } from './angular-cli-webpack';
import { PresetOptions } from './preset-options';
import { moduleIsAvailable } from './utils/module-is-available';

export async function webpackFinal(baseConfig: webpack.Configuration, options: PresetOptions) {
  if (!moduleIsAvailable('@angular-devkit/build-angular')) {
    logger.info('=> Using base config because "@angular-devkit/build-angular" is not installed');
    return baseConfig;
  }

  checkForLegacyBuildOptions(options);

  const builderContext = getBuilderContext(options);
  const builderOptions = await getBuilderOptions(options, builderContext);

  return getCustomWebpackConfig(baseConfig, {
    builderOptions: {
      watch: options.configType === 'DEVELOPMENT',
      ...builderOptions,
    },
    builderContext,
  });
}

/** Get Builder Context If storybook is not start by angular builder create dumb BuilderContext */
function getBuilderContext(options: PresetOptions): BuilderContext {
  return (
    options.angularBuilderContext ??
    ({
      target: { project: 'noop-project', builder: '', options: {} },
      workspaceRoot: process.cwd(),
      getProjectMetadata: () => ({}),
      getTargetOptions: () => ({}),
      logger: new logging.Logger('Storybook'),
    } as unknown as BuilderContext)
  );
}

/** Get builder options Merge target options from browser target and from storybook options */
async function getBuilderOptions(
  options: PresetOptions,
  builderContext: BuilderContext
): Promise<JsonObject> {
  /** Get Browser Target options */
  let browserTargetOptions: JsonObject = {};
  if (options.angularBrowserTarget) {
    const browserTarget = targetFromTargetString(options.angularBrowserTarget);

    logger.info(
      `=> Using angular browser target options from "${browserTarget.project}:${
        browserTarget.target
      }${browserTarget.configuration ? `:${browserTarget.configuration}` : ''}"`
    );
    browserTargetOptions = await builderContext.getTargetOptions(browserTarget);
  }

  /** Merge target options from browser target options and from storybook options */
  const builderOptions = {
    ...browserTargetOptions,
    ...(options.angularBuilderOptions as JsonObject),
    tsConfig:
      options.tsConfig ??
      findUpSync('tsconfig.json', { cwd: options.configDir }) ??
      browserTargetOptions.tsConfig,
  };
  logger.info(`=> Using angular project with "tsConfig:${builderOptions.tsConfig}"`);

  return builderOptions;
}

/**
 * Checks if using legacy configuration that doesn't use builder and logs message referring to
 * migration docs.
 */
function checkForLegacyBuildOptions(options: PresetOptions) {
  if (options.angularBrowserTarget !== undefined) {
    // Not use legacy way with builder (`angularBrowserTarget` is defined or null with builder and undefined without)
    return;
  }

  throw new AngularLegacyBuildOptionsError();
}
