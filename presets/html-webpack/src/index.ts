import type { StorybookConfig } from './types';

export * from './types';

export const webpack: StorybookConfig['webpack'] = (config) => {
  const rules = [
    ...(config.module?.rules || []),
    {
      test: /\.html$/,
      use: require.resolve('html-loader') as string,
    },
  ];

  config.module = config.module || {};

  config.module.rules = rules;

  return config;
};
