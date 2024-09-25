import type { StorybookConfig } from './types';

export * from './types';

export const webpack: StorybookConfig['webpack'] = (config) => {
  const rules = [
    ...(config.module?.rules || []),
    {
      type: 'javascript/auto',
      test: /\.stories\.json$/,
      use: require.resolve('@storybook/preset-server-webpack/dist/loader'),
    },

    {
      type: 'javascript/auto',
      test: /\.stories\.ya?ml/,
      use: [
        require.resolve('@storybook/preset-server-webpack/dist/loader'),
        {
          loader: require.resolve('yaml-loader'),
          options: { asJSON: true },
        },
      ],
    },
  ];

  config.module = config.module || {};

  config.module.rules = rules;

  return config;
};
