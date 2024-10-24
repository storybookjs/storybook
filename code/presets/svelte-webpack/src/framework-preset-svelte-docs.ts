import type { Preset } from '@storybook/core-webpack';

import type { StorybookConfig, SvelteOptions } from './types';

export const webpackFinal: StorybookConfig['webpackFinal'] = async (config, { presets }) => {
  const framework = await presets.apply<Preset>('framework');
  const svelteOptions = (typeof framework === 'object' ? framework.options : {}) as SvelteOptions;

  const rules = [
    ...(config.module?.rules || []),
    {
      test: /\.svelte$/,
      loader: require.resolve(`@storybook/preset-svelte-webpack/svelte-docgen-loader`),
      enforce: 'post',
      options: svelteOptions,
    },
  ];

  config.module = config.module || {};

  config.module.rules = rules;

  return config;
};
