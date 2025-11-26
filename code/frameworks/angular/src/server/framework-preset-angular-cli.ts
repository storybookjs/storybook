import { logger } from 'storybook/internal/node-logger';
import { AngularLegacyBuildOptionsError } from 'storybook/internal/server-errors';
import { WebpackDefinePlugin, WebpackIgnorePlugin } from '@storybook/builder-webpack5';

import type { BuilderContext } from '@angular-devkit/architect';
import { targetFromTargetString } from '@angular-devkit/architect';
import type { JsonObject } from '@angular-devkit/core';
import { logging } from '@angular-devkit/core';
import * as find from 'empathic/find';
import type webpack from 'webpack';

import { getWebpackConfig as getCustomWebpackConfig } from './angular-cli-webpack';
import type { PresetOptions } from './preset-options';
import { getProjectRoot, resolvePackageDir } from 'storybook/internal/common';
import { relative } from 'pathe';

export async function webpackFinal(baseConfig: webpack.Configuration, options: PresetOptions) {
  if (!resolvePackageDir('@angular-devkit/build-angular')) {
    logger.info('Using base config because "@angular-devkit/build-angular" is not installed');
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
    resolvePackageDir('@angular/animations');
  } catch (e) {
    webpackConfig.plugins.push(
      new WebpackIgnorePlugin({
        resourceRegExp: /@angular\/platform-browser\/animations$/,
      })
    );
    webpackConfig.plugins.push(
      new WebpackIgnorePlugin({
        resourceRegExp: /@angular\/animations\/browser$/,
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

/**
 * Deep merge function that properly handles nested objects. Preserves arrays and objects from
 * source when they exist in target
 *
 * @internal - exported for testing purposes
 */
export function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key]) &&
        target[key] !== null
      ) {
        // Deep merge nested objects
        result[key] = deepMerge(target[key] as JsonObject, source[key] as JsonObject);
      } else {
        // Override with source value
        result[key] = source[key];
      }
    }
  }

  return result;
}

/** Get builder options Merge target options from browser target and from storybook options */
export async function getBuilderOptions(options: PresetOptions, builderContext: BuilderContext) {
  /** Get Browser Target options */
  let browserTargetOptions: JsonObject = {};
  if (options.angularBrowserTarget) {
    const browserTarget = targetFromTargetString(options.angularBrowserTarget);

    logger.info(
      `Using angular browser target options from "${browserTarget.project}:${
        browserTarget.target
      }${browserTarget.configuration ? `:${browserTarget.configuration}` : ''}"`
    );
    browserTargetOptions = await builderContext.getTargetOptions(browserTarget);
  }

  if (
    Object.keys(options.frameworkOptions?.angularBuilderOptions || {}).length > 0
  ) {
    options.angularBuilderOptions = {
      ...options.frameworkOptions.angularBuilderOptions,
      ...options.angularBuilderOptions, // allow override by CLI if present
    };
  }

  // `options.angularBuilderOptions` implicitly adds all options a target can have
  // To figure out what user-land actually has explicitly defined in their target options, we
  // manually need to read them
  const explicitAngularBuilderOptions = await builderContext.getTargetOptions(
    builderContext.target
  );

  /**
   * Merge target options from browser target options and from storybook options Use deep merge to
   * preserve nested properties like stylePreprocessorOptions.includePaths when they exist in
   * browserTarget but not in storybook options
   */
  const builderOptions = deepMerge(browserTargetOptions, explicitAngularBuilderOptions || {});

  // Handle tsConfig separately to maintain existing logic
  builderOptions.tsConfig =
    options.tsConfig ??
    find.up('tsconfig.json', { cwd: options.configDir, last: getProjectRoot() }) ??
    browserTargetOptions.tsConfig;
  logger.info(
    `Using angular project with "tsConfig:${relative(getProjectRoot(), builderOptions.tsConfig as string)}"`
  );

  builderOptions.experimentalZoneless = options.angularBuilderOptions?.experimentalZoneless;

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
