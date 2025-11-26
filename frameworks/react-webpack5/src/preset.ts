import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import { WebpackDefinePlugin } from '@storybook/builder-webpack5';

import type { StorybookConfig } from './types';

export const addons: PresetProperty<'addons'> = [
  fileURLToPath(import.meta.resolve('@storybook/preset-react-webpack')),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: fileURLToPath(import.meta.resolve('@storybook/builder-webpack5')),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: fileURLToPath(import.meta.resolve('@storybook/react/preset')),
  };
};

export const webpack: StorybookConfig['webpack'] = async (config, options) => {
  config.resolve = config.resolve || {};

  config.resolve.alias = {
    ...config.resolve?.alias,
    '@storybook/react': fileURLToPath(import.meta.resolve('@storybook/react')),
  };

  if (options.features?.developmentModeForBuild) {
    config.plugins = [
      // @ts-expect-error Ignore this error, because in the `webpack` preset the user actually hasn't defined a config yet.
      ...config.plugins,
      new WebpackDefinePlugin({
        NODE_ENV: JSON.stringify('development'),
      }),
    ];
  }

  return config;
};
