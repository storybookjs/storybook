import type { EnrichCsfOptions } from 'storybook/internal/csf-tools';

import { createUnplugin } from 'unplugin';

import { STORIES_REGEX } from './constants';
import { rollupBasedPlugin } from './rollup-based-plugin';

export type CsfPluginOptions = EnrichCsfOptions;

export const unplugin = createUnplugin<CsfPluginOptions>((options) => {
  return {
    name: 'unplugin-csf',
    rollup: {
      ...rollupBasedPlugin(options),
    },
    vite: {
      enforce: 'pre',
      ...rollupBasedPlugin(options),
    },
    webpack(compiler) {
      compiler.options.module.rules.unshift({
        test: STORIES_REGEX,
        enforce: 'post',
        use: {
          options,
          loader: require.resolve('@storybook/csf-plugin/dist/webpack-loader'),
        },
      });
    },
    rspack(compiler) {
      compiler.options.module.rules.unshift({
        test: STORIES_REGEX,
        enforce: 'post',
        use: {
          options,
          loader: require.resolve('@storybook/csf-plugin/dist/webpack-loader'),
        },
      });
    },
  };
});

export const { esbuild } = unplugin;
export const { webpack } = unplugin;
export const { rollup } = unplugin;
export const { vite } = unplugin;
