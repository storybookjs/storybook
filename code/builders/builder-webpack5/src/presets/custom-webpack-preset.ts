import { fileURLToPath } from 'node:url';

import { findConfigFile } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { Options, PresetProperty } from 'storybook/internal/types';

import { loadCustomWebpackConfig } from '@storybook/core-webpack';

import webpackModule from 'webpack';
import type { Configuration } from 'webpack';

// import { WebpackInjectMockerRuntimePlugin } from '../plugins/webpack-inject-mocker-runtime-plugin';
// import { WebpackMockPlugin } from '../plugins/webpack-mock-plugin';
import { createDefaultWebpackConfig } from '../preview/base-webpack.config';

export const swc: PresetProperty<'swc'> = (config: Record<string, any>): Record<string, any> => {
  return {
    ...config,
    env: {
      ...(config?.env ?? {}),
      targets: config?.env?.targets ?? {
        chrome: 100,
        safari: 15,
        firefox: 91,
      },
      // Transpiles the broken syntax to the closest non-broken modern syntax.
      // E.g. it won't transpile parameter destructuring in Safari
      // which would break how we detect if the mount context property is used in the play function.
      bugfixes: config?.env?.bugfixes ?? true,
    },
  };
};

export async function webpackFinal(config: Configuration, options: Options) {
  const previewConfigPath = findConfigFile('preview', options.configDir);

  // If there's no preview file, there's nothing to mock.
  if (!previewConfigPath) {
    return config;
  }

  config.plugins = config.plugins || [];

  // 1. Add the loader to normalize sb.mock(import(...)) calls.
  // Temporarily disabled: module-mocking transform
  // config.module!.rules!.push({
  //   test: /preview\.(t|j)sx?$/,
  //   use: [
  //     {
  //       loader: fileURLToPath(
  //         import.meta.resolve('@storybook/builder-webpack5/loaders/storybook-mock-transform-loader')
  //       ),
  //     },
  //   ],
  // });

  // 2. Add the plugin to handle module replacement based on sb.mock() calls.
  // This plugin scans the preview file and sets up rules to swap modules.
  // Temporarily disabled: module-mocking plugin
  // config.plugins.push(new WebpackMockPlugin({ previewConfigPath }));

  // 3. Add the plugin to inject the mocker runtime script into the HTML.
  // This ensures the `sb` object is available before any other code runs.
  // Temporarily disabled: injected mocker runtime script
  // config.plugins.push(new WebpackInjectMockerRuntimePlugin());
  return config;
}

export async function webpack(config: Configuration, options: Options) {
  const { configDir, configType, presets } = options;

  const coreOptions = await presets.apply('core');

  let defaultConfig = config;
  if (!coreOptions?.disableWebpackDefaults) {
    defaultConfig = await createDefaultWebpackConfig(config, options);
  }

  const finalDefaultConfig = await presets.apply('webpackFinal', defaultConfig, options);

  // Check whether user has a custom webpack config file and
  // return the (extended) base configuration if it's not available.
  const customConfig = await loadCustomWebpackConfig(configDir);

  if (typeof customConfig === 'function') {
    logger.info('Loading custom Webpack config (full-control mode).');
    return customConfig({ config: finalDefaultConfig, mode: configType });
  }

  logger.info('Using default Webpack5 setup');
  return finalDefaultConfig;
}

export const webpackInstance = async () => webpackModule;
export const webpackVersion = async () => '5';
