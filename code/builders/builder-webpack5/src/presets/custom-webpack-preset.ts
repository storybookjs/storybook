import { logger } from 'storybook/internal/node-logger';
import type { Options, PresetProperty } from 'storybook/internal/types';

import { loadCustomWebpackConfig } from '@storybook/core-webpack';

import * as webpackReal from 'webpack';
import type { Configuration } from 'webpack';

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
  const customConfig = loadCustomWebpackConfig(configDir);

  if (typeof customConfig === 'function') {
    logger.info('=> Loading custom Webpack config (full-control mode).');
    return customConfig({ config: finalDefaultConfig, mode: configType });
  }

  logger.info('=> Using default Webpack5 setup');
  return finalDefaultConfig;
}

export const webpackInstance = async () => webpackReal;
export const webpackVersion = async () => '5';
