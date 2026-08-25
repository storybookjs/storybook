import { fileURLToPath } from 'node:url';

import type { Configuration } from 'webpack';

import type { StorybookConfig } from './types.ts';

export const webpackFinal: StorybookConfig['webpackFinal'] = async (
  config,
  options
): Promise<Configuration> => {
  const features = await options.presets.apply('features', {});
  if (features?.experimentalDocgenServer) {
    // The docgen service owns React metadata extraction for this mode. Do not inject
    // `Component.__docgenInfo` into the preview bundle, otherwise preview argTypes would include
    // docgen data that the UI is now responsible for merging from the service.
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
            loader: fileURLToPath(
              import.meta.resolve('@storybook/preset-react-webpack/react-docgen-loader')
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
          loader: fileURLToPath(
            import.meta.resolve('@storybook/preset-react-webpack/react-docgen-loader')
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
