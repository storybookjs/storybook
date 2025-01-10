import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

import { WebpackDefinePlugin } from '@storybook/builder-webpack5';

import type { StorybookConfig } from './types';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const addons: PresetProperty<'addons'> = [
  getAbsolutePath('@storybook/preset-react-webpack'),
];

export const core: PresetProperty<'core'> = async (config, options) => {
  const framework = await options.presets.apply('framework');

  return {
    ...config,
    builder: {
      name: getAbsolutePath('@storybook/builder-webpack5'),
      options: typeof framework === 'string' ? {} : framework.options.builder || {},
    },
    renderer: getAbsolutePath('@storybook/react'),
  };
};

export const webpack: StorybookConfig['webpack'] = async (config, options) => {
  config.resolve = config.resolve || {};

  config.resolve.alias = {
    ...config.resolve?.alias,
    '@storybook/react': getAbsolutePath('@storybook/react'),
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
