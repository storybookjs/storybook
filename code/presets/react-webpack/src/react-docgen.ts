import { fileURLToPath } from 'node:url';

import { deprecate } from '@storybook/core/internal/node-logger';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

import type { Configuration } from 'webpack';

import type { TypescriptOptions } from './types.ts';

/** Add the builder docgen loader and plugin that `typescript.reactDocgen` selects when server docgen is off. */
export async function withReactDocgen(
  config: Configuration,
  {
    features,
    typescript,
    debug,
  }: {
    features: StorybookConfigRaw['features'];
    typescript: Partial<TypescriptOptions> | undefined;
    debug: boolean;
  }
): Promise<Configuration> {
  if (features?.docgenServer) {
    // The docgen service owns React metadata extraction for this mode. Do not inject
    // `Component.__docgenInfo` into the preview bundle, otherwise preview argTypes would include
    // docgen data that the UI is now responsible for merging from the service.
    return config;
  }

  const { reactDocgen, reactDocgenTypescriptOptions } = typescript || {};

  if (typeof reactDocgen !== 'string') {
    return config;
  }

  deprecate(
    `Builder docgen (\`typescript.reactDocgen: '${reactDocgen}'\`) is deprecated and will be removed in Storybook 12. ` +
      `It runs because \`features.docgenServer\` is off. Server-side docgen needs the \`typescript\` package: install it and remove any \`docgenServer: false\` from your \`.storybook/main.ts\`.`
  );

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
}
