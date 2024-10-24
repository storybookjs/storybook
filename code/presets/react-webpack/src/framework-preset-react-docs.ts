import { hasDocsOrControls } from 'storybook/internal/docs-tools';

import type { Configuration } from 'webpack';

import { requirer } from './requirer';
import type { StorybookConfig } from './types';

export const webpackFinal: StorybookConfig['webpackFinal'] = async (
  config,
  options
): Promise<Configuration> => {
  if (!hasDocsOrControls(options)) {
    return config;
  }

  const typescriptOptions = await options.presets.apply('typescript', {} as any);
  const debug = options.loglevel === 'debug';

  const { reactDocgen, reactDocgenTypescriptOptions } = typescriptOptions || {};

  if (typeof reactDocgen !== 'string') {
    return config;
  }

  if (reactDocgen !== 'react-docgen-typescript') {
    return {
      ...config,
      module: {
        ...(config.module ?? {}),
        rules: [
          ...(config.module?.rules ?? []),
          {
            test: /\.(cjs|mjs|tsx?|jsx?)$/,
            enforce: 'pre',
            loader: requirer(
              require.resolve,
              '@storybook/preset-react-webpack/loaders/react-docgen-loader'
            ),
            options: {
              debug,
            },
            exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
          },
        ],
      },
    };
  }

  const { ReactDocgenTypeScriptPlugin } = await import('@storybook/react-docgen-typescript-plugin');

  return {
    ...config,
    module: {
      ...(config.module ?? {}),
      rules: [
        ...(config.module?.rules ?? []),
        {
          test: /\.(cjs|mjs|jsx?)$/,
          enforce: 'pre',
          loader: requirer(
            require.resolve,
            '@storybook/preset-react-webpack/loaders/react-docgen-loader'
          ),
          options: {
            debug,
          },
          exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
        },
      ],
    },
    plugins: [
      ...(config.plugins || []),
      new ReactDocgenTypeScriptPlugin({
        ...reactDocgenTypescriptOptions,
        // We *need* this set so that RDT returns default values in the same format as react-docgen
        savePropValueAsString: true,
      }),
    ],
  };
};
