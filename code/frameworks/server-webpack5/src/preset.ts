import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import type { StorybookConfig } from './types.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-webpack5'),
  renderer: import.meta.resolve('@storybook/server/preset'),
};

export const webpack: StorybookConfig['webpack'] = (config) => {
  const rules = [
    ...(config.module?.rules || []),
    {
      type: 'javascript/auto',
      test: /\.stories\.json$/,
      use: fileURLToPath(import.meta.resolve('@storybook/server-webpack5/loader')),
    },

    {
      type: 'javascript/auto',
      test: /\.stories\.ya?ml/,
      use: [
        fileURLToPath(import.meta.resolve('@storybook/server-webpack5/loader')),
        {
          loader: fileURLToPath(import.meta.resolve('yaml-loader')),
          options: { asJSON: true },
        },
      ],
    },
  ];

  config.module = config.module || {};
  config.module.rules = rules;

  return config;
};
