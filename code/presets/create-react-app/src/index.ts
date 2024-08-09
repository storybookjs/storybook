import { logger } from 'storybook/internal/node-logger';

import { dirname, join, relative } from 'path';
import PnpWebpackPlugin from 'pnp-webpack-plugin';
import type { Configuration, RuleSetRule, WebpackPluginInstance } from 'webpack';

import { checkPresets } from './helpers/checkPresets';
import { getModulePath } from './helpers/getModulePath';
import { getReactScriptsPath } from './helpers/getReactScriptsPath';
import { mergePlugins } from './helpers/mergePlugins';
import { processCraConfig } from './helpers/processCraConfig';
import type { PluginOptions } from './types';

const CWD = process.cwd();

const REACT_SCRIPTS_PATH = getReactScriptsPath();
const OPTION_SCRIPTS_PACKAGE = 'scriptsPackageName';

// Ensures that assets are served from the correct path when Storybook is built.
// Resolves: https://github.com/storybookjs/storybook/issues/4645
if (!process.env.PUBLIC_URL) {
  process.env.PUBLIC_URL = '.';
}

type ResolveLoader = Configuration['resolveLoader'];

// This loader is shared by both the `managerWebpack` and `webpack` functions.
const resolveLoader: ResolveLoader = {
  modules: ['node_modules', join(REACT_SCRIPTS_PATH, 'node_modules')],
  plugins: [PnpWebpackPlugin.moduleLoader(module)],
};

// TODO: Replace with exported type from Storybook.

const core = (existing: { disableWebpackDefaults: boolean }) => ({
  ...existing,
  disableWebpackDefaults: true,
});

// Update the core Webpack config.
const webpack = async (
  webpackConfig: Configuration = {},
  options: PluginOptions
): Promise<Configuration> => {
  let scriptsPath = REACT_SCRIPTS_PATH;

  // Flag any potentially conflicting presets.
  checkPresets(options);

  // If the user has provided a package by name, try to resolve it.
  const scriptsPackageName = options[OPTION_SCRIPTS_PACKAGE];
  if (typeof scriptsPackageName === 'string') {
    try {
      scriptsPath = dirname(
        require.resolve(`${scriptsPackageName}/package.json`, {
          paths: [options.configDir],
        })
      );
    } catch (e) {
      logger.warn(`A \`${OPTION_SCRIPTS_PACKAGE}\` was provided, but couldn't be resolved.`);
    }
  }

  // If there isn't a scripts-path set, return the Webpack config unmodified.
  if (!scriptsPath) {
    logger.error('Failed to resolve a `react-scripts` package.');
    return webpackConfig;
  }

  logger.info(`=> Loading Webpack configuration from \`${relative(CWD, scriptsPath)}\``);

  // Remove existing rules related to JavaScript and TypeScript.
  logger.info(`=> Removing existing JavaScript and TypeScript rules.`);
  const filteredRules = (webpackConfig.module?.rules as RuleSetRule[])?.filter((rule) => {
    if (typeof rule === 'string') {
      return false;
    }
    const { test } = rule;
    return !(test instanceof RegExp && (test?.test('.js') || test?.test('.ts')));
  });

  // Require the CRA config and set the appropriate mode.
  const craWebpackConfigPath = join(scriptsPath, 'config', 'webpack.config');

  const craWebpackConfig = require(craWebpackConfigPath)(webpackConfig.mode) as Configuration;

  // Select the relevant CRA rules and add the Storybook config directory.
  logger.info(`=> Modifying Create React App rules.`);
  const craRules = await processCraConfig(craWebpackConfig, options);

  // NOTE: This is code replicated from
  //   https://github.com/storybookjs/storybook/blob/89830ad76384faeaeb0c19df3cb44232cdde261b/builders/builder-webpack5/src/preview/base-webpack.config.ts#L45-L53
  // as we are not applying SB's default webpack config here.
  // We need to figure out a better way to apply various layers of webpack config; perhaps
  // these options need to be in a separate preset.
  const isProd = webpackConfig.mode !== 'development';
  const coreOptions = await options.presets.apply('core');
  const builder = coreOptions?.builder;
  const builderOptions = typeof builder === 'string' ? {} : builder?.options;
  const cacheConfig = builderOptions?.fsCache ? { cache: { type: 'filesystem' } } : {};
  const lazyCompilationConfig =
    builderOptions?.lazyCompilation && !isProd
      ? { experiments: { lazyCompilation: { entries: false } } }
      : {};

  // Return the new config.
  return {
    ...webpackConfig,
    ...cacheConfig,
    ...lazyCompilationConfig,
    module: {
      ...webpackConfig.module,
      rules: [...(filteredRules || []), ...craRules],
    },
    // NOTE: this prioritizes the storybook version of a plugin
    // when there are duplicates between SB and CRA
    plugins: mergePlugins(
      ...((webpackConfig.plugins ?? []) as WebpackPluginInstance[]),
      ...((craWebpackConfig.plugins ?? []) as WebpackPluginInstance[])
    ),
    resolve: {
      ...webpackConfig.resolve,
      extensions: craWebpackConfig.resolve?.extensions,
      modules: [
        ...((webpackConfig.resolve && webpackConfig.resolve.modules) || []),
        join(REACT_SCRIPTS_PATH, 'node_modules'),
        ...getModulePath(CWD),
      ],
      plugins: [PnpWebpackPlugin as any],
      // manual copy from builder-webpack because defaults are disabled in this CRA preset
      conditionNames: [
        ...(webpackConfig.resolve?.conditionNames ?? []),
        'storybook',
        'stories',
        'test',
        '...',
      ],
    },
    resolveLoader,
  } as Configuration;
};

// we do not care of the typings exported from this package
const exportedCore = core as any;
const exportedWebpack = webpack as any;

export { exportedCore as core, exportedWebpack as webpack };
