import { logger } from 'storybook/internal/node-logger';
import { AngularLegacyBuildOptionsError } from 'storybook/internal/server-errors';
import { WebpackDefinePlugin, WebpackIgnorePlugin } from '@storybook/builder-webpack5';

import type { BuilderContext } from '@angular-devkit/architect';
import { targetFromTargetString } from '@angular-devkit/architect';
import type { JsonObject } from '@angular-devkit/core';
import { logging } from '@angular-devkit/core';
import { findUp } from 'find-up';
import type webpack from 'webpack';

import { getWebpackConfig as getCustomWebpackConfig } from './angular-cli-webpack';
import type { PresetOptions } from './preset-options';
import { moduleIsAvailable } from './utils/module-is-available';
import { getProjectRoot } from 'storybook/internal/common';

export async function webpackFinal(baseConfig: webpack.Configuration, options: PresetOptions) {
  if (!moduleIsAvailable('@angular-devkit/build-angular')) {
    logger.info('=> Using base config because "@angular-devkit/build-angular" is not installed');
    return baseConfig;
  }

  checkForLegacyBuildOptions(options);

  const builderContext = getBuilderContext(options);
  const builderOptions = await getBuilderOptions(options, builderContext);

  const webpackConfig = await getCustomWebpackConfig(baseConfig, {
    builderOptions: {
      watch: options.configType === 'DEVELOPMENT',
      ...builderOptions,
    } as any,
    builderContext,
  });

  webpackConfig.plugins = webpackConfig.plugins ?? [];

  // Change the generated css filename to include the contenthash for cache busting
  const miniCssPlugin = webpackConfig?.plugins?.find(
    (plugin: any) => plugin?.constructor?.name === 'MiniCssExtractPlugin'
  ) as any;

  if (miniCssPlugin && 'options' in miniCssPlugin) {
    miniCssPlugin.options.filename = '[name].[contenthash].css';
    miniCssPlugin.options.chunkFilename = '[name].iframe.[contenthash].css';
  }

  webpackConfig.plugins.push(
    new WebpackDefinePlugin({
      STORYBOOK_ANGULAR_OPTIONS: JSON.stringify({
        experimentalZoneless: builderOptions.experimentalZoneless,
      }),
    })
  );

  try {
    require.resolve('@angular/animations');
  } catch (e) {
    webpackConfig.plugins.push(
      new WebpackIgnorePlugin({
        resourceRegExp: /@angular\/platform-browser\/animations$/,
      })
    );
  }

  return webpackConfig;
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
async function getBuilderOptions(options: PresetOptions, builderContext: BuilderContext) {
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
    ...options.angularBuilderOptions,
    tsConfig:
      options.tsConfig ??
      (await findUp('tsconfig.json', { cwd: options.configDir, stopAt: getProjectRoot() })) ??
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
