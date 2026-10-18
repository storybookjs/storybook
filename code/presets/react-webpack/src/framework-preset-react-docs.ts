import { fileURLToPath } from 'node:url';

import type { Configuration, RuleSetRule } from 'webpack';

import type { ReactDocgenPlan } from '../../../renderers/react/src/docgen/engine.ts';
import type { StorybookConfig } from './types.ts';

export const webpackFinal: StorybookConfig['webpackFinal'] = async (
  config,
  options
): Promise<Configuration> => {
  const { builder } = await options.presets.apply<ReactDocgenPlan>('internal_reactDocgenPlan');

  if (!builder.reactDocgen && !builder.reactDocgenTypescript) {
    return config;
  }

  const rules: RuleSetRule[] = builder.reactDocgen
    ? [
        {
          test: builder.reactDocgen === 'all' ? /\.(cjs|mjs|tsx?|jsx?)$/ : /\.(cjs|mjs|jsx?)$/,
          enforce: 'pre',
          loader: fileURLToPath(
            import.meta.resolve('@storybook/preset-react-webpack/react-docgen-loader')
          ),
          options: {
            debug: options.loglevel === 'debug',
          },
          exclude: /(\.(stories|story)\.(js|jsx|ts|tsx))|(node_modules)/,
        },
      ]
    : [];

  const module = { ...config.module, rules: [...(config.module?.rules ?? []), ...rules] };

  if (!builder.reactDocgenTypescript) {
    return { ...config, module };
  }

  const { reactDocgenTypescriptOptions } = await options.presets.apply('typescript', {} as any);
  const { ReactDocgenTypeScriptPlugin } = await import('@storybook/react-docgen-typescript-plugin');

  return {
    ...config,
    module,
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
