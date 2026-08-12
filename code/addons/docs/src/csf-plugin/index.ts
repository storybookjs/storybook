import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';

import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';

import { STORIES_REGEX } from './constants.ts';
import { rollupBasedPlugin, transformCsf } from './rollup-based-plugin.ts';

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
    // Stay in the `pre` bucket with framework compilers (e.g. AnalogJS), but run
    // after their default-order transforms so enrichment is not discarded when a
    // plugin re-emits from its own source instead of transforming `code`.
    enforce: 'pre',
    name: 'plugin-csf',
    transform: {
      order: 'post',
      async handler(code, id) {
        return transformCsf.call(this, code, id, options);
      },
    },
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
