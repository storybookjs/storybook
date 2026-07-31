import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';

import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';

import { STORIES_REGEX } from './constants.ts';
import { rollupBasedPlugin } from './rollup-based-plugin.ts';

export type CsfPluginOptions = EnrichCsfOptions;

const webpackLoader = resolve(
  dirname(fileURLToPath(import.meta.resolve('@storybook/addon-docs/package.json'))),
  'dist/csf-plugin/webpack-loader.js'
);

const unpluginFactory: UnpluginFactory<EnrichCsfOptions> = (options) => ({
  name: 'unplugin-csf',
  rollup: {
    ...rollupBasedPlugin(options),
  },
  vite: {
    enforce: 'pre',
    ...(rollupBasedPlugin(options) as any),
  },
  webpack(compiler) {
    compiler.options.module.rules.unshift({
      test: STORIES_REGEX,
      enforce: 'post',
      use: {
        options,
        loader: webpackLoader,
      },
    });
  },
  rspack(compiler) {
    compiler.options.module.rules.unshift({
      test: STORIES_REGEX,
      enforce: 'post',
      use: {
        options,
        loader: webpackLoader,
      },
    });
  },
});

const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory);

export const { webpack, vite } = unplugin;
