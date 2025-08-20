import { fileURLToPath } from 'node:url';

import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';

import type { UnpluginFactory } from 'unplugin';
import { createUnplugin } from 'unplugin';

import { STORIES_REGEX } from './constants';
import { rollupBasedPlugin } from './rollup-based-plugin';

export type CsfPluginOptions = EnrichCsfOptions;

export const unpluginFactory: UnpluginFactory<EnrichCsfOptions> = (options) => {
  return {
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
          loader: fileURLToPath(import.meta.resolve('@storybook/csf-plugin/webpack-loader')),
        },
      });
    },
    rspack(compiler) {
      compiler.options.module.rules.unshift({
        test: STORIES_REGEX,
        enforce: 'post',
        use: {
          options,
          loader: fileURLToPath(import.meta.resolve('@storybook/csf-plugin/webpack-loader')),
        },
      });
    },
  };
};

export const unplugin = /* #__PURE__ */ createUnplugin(unpluginFactory);

export const { esbuild } = unplugin;
export const { webpack } = unplugin;
export const { rollup } = unplugin;
export const { vite } = unplugin;
