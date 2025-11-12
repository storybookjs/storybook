import { fileURLToPath } from 'node:url';

import type { StorybookConfig } from './types';

export * from './types';

export const webpack: StorybookConfig['webpack'] = (config) => {
  const rules = [
    ...(config.module?.rules || []),
    {
      type: 'javascript/auto',
      test: /\.stories\.json$/,
      use: fileURLToPath(import.meta.resolve('@storybook/preset-server-webpack/loader')),
    },

    {
      type: 'javascript/auto',
      test: /\.stories\.ya?ml/,
      use: [
        fileURLToPath(import.meta.resolve('@storybook/preset-server-webpack/loader')),
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
