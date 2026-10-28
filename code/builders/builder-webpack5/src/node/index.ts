import '../hooks.ts';

import { defineBuilder } from '@storybook/core';

import { createWebpackBuilder } from '../builder.ts';
import type { BuilderOptions } from '../types.ts';

/** Configure the preview compiler. */
export type WebpackBuilderOptions = BuilderOptions;

/** Create an isolated Webpack preview builder. */
export const webpack = defineBuilder<WebpackBuilderOptions | void>((input) => {
  // Without factory options the builder falls back to `main.ts` `core.builder.options`.
  const options = input || undefined;
  return {
    meta: { name: '@storybook/builder-webpack5' },
    hmr: 'webpack',
    setup(storybook): void {
      // Builds read the factory options; `core` keeps only the options presets declared.
      storybook.hook('core:config:extend', (core) => ({
        ...core,
        builder: {
          name: import.meta.resolve('@storybook/builder-webpack5'),
          options: (typeof core?.builder === 'object' && core.builder.options) || {},
        },
      }));
      storybook.hook(
        'builder:swc:extend',
        (config) => {
          const { features } = storybook.options;
          const removeBugfixes =
            !!features && 'babelRemoveBugfixes' in features && !!features.babelRemoveBugfixes;
          const env = (config?.env ?? {}) as Record<string, unknown>;
          return {
            ...config,
            env: {
              ...env,
              targets: env.targets ?? { chrome: 100, safari: 15, firefox: 91 },
              // Keep `bugfixes` so Safari parameter destructuring stays detectable for `mount`.
              ...(removeBugfixes ? {} : { bugfixes: env.bugfixes ?? true }),
            },
          };
        },
        'reduce',
        'override'
      );
    },
    ...createWebpackBuilder(options),
  };
});

export default webpack;
