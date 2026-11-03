import { fileURLToPath } from 'node:url';

import {
  type ReactDocgenOption,
  checkReactBuilderDocgenPackages,
  getReactBuilderDocgenPackages,
  getTypeScriptForDocgenError,
  isPackageResolvable,
} from 'storybook/internal/common';

import type { Configuration } from 'webpack';

import type { StorybookConfig } from './types.ts';

/** Resolve from this package, which declares the builder docgen packages as optional peers. */
const resolve = (specifier: string) => import.meta.resolve(specifier);

export const webpackFinal: StorybookConfig['webpackFinal'] = async (
  config,
  options
): Promise<Configuration> => {
  const features = await options.presets.apply('features', {});
  if (features?.docgenServer) {
    // The docgen service owns React metadata extraction for this mode. Do not inject
    // `Component.__docgenInfo` into the preview bundle, otherwise preview argTypes would include
    // docgen data that the UI is now responsible for merging from the service.
    return config;
  }

  const typescriptOptions = await options.presets.apply<{
    reactDocgen?: ReactDocgenOption;
    reactDocgenTypescriptOptions?: Record<string, unknown>;
  }>('typescript', {});
  const debug = options.loglevel === 'debug';

  const { reactDocgen, reactDocgenTypescriptOptions } = typescriptOptions || {};

  if (typeof reactDocgen !== 'string') {
    return config;
  }

  // react-docgen-typescript runs the TypeScript compiler API, so it falls back to react-docgen
  // without a usable `typescript`.
  const useReactDocgenTypescript =
    reactDocgen === 'react-docgen-typescript' && !getTypeScriptForDocgenError(resolve);

  // Builder docgen packages are optional peers: the loader and plugin import them only once
  // builder docgen runs, so projects on the docgen server never resolve them.
  const missingPackages = await checkReactBuilderDocgenPackages({
    reactDocgen,
    packages: getReactBuilderDocgenPackages(
      useReactDocgenTypescript ? 'react-docgen-typescript' : 'react-docgen',
      'webpack'
    ),
    resolve,
    options,
  });
  if (missingPackages.length > 0) {
    return config;
  }

  if (!useReactDocgenTypescript) {
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

  // In react-docgen-typescript mode, react-docgen is optional and only covers JavaScript files.
  const javaScriptDocgenRules = isPackageResolvable(resolve, 'react-docgen')
    ? [
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
        } as const,
      ]
    : [];

  return {
    ...config,
    module: {
      ...(config.module ?? {}),
      rules: [...(config.module?.rules ?? []), ...javaScriptDocgenRules],
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
