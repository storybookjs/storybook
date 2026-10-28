import { fileURLToPath } from 'node:url';

import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import { WebpackDefinePlugin } from '@storybook/builder-webpack5';

import type { StorybookConfig } from './types.ts';

type WebpackConfig = Parameters<NonNullable<StorybookConfig['webpack']>>[0];

/** Alias the React renderer, and build React in development mode when `developmentModeForBuild` is on. */
export function withReactWebpackConfig(
  config: WebpackConfig,
  features: StorybookConfigRaw['features']
): WebpackConfig {
  config.resolve = config.resolve || {};

  config.resolve.alias = {
    ...config.resolve?.alias,
    '@storybook/react': fileURLToPath(import.meta.resolve('@storybook/react')),
  };

  if (features?.developmentModeForBuild) {
    config.plugins = [
      // @ts-expect-error Ignore this error, because in the `webpack` preset the user actually hasn't defined a config yet.
      ...config.plugins,
      new WebpackDefinePlugin({
        NODE_ENV: JSON.stringify('development'),
      }),
    ];
  }

  return config;
}
