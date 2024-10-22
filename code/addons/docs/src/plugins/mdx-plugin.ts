import { dirname, join } from 'node:path';

import type { Options } from 'storybook/internal/types';

import { createFilter } from '@rollup/pluginutils';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSlug from 'rehype-slug';
import type { Plugin } from 'vite';

import type { CompileOptions } from '../compiler';
import { compile } from '../compiler';

/**
 * Storybook uses a single loader when dealing with MDX:
 *
 * - *.mdx are compiled with the MDX compiler directly
 *
 * @see https://github.com/storybookjs/storybook/blob/next/addons/docs/docs/recipes.md#csf-stories-with-arbitrary-mdx
 */
export async function mdxPlugin(options: Options): Promise<Plugin> {
  const include = /\.mdx$/;
  const filter = createFilter(include);
  const { presets } = options;
  const presetOptions = await presets.apply<Record<string, any>>('options', {});
  const mdxPluginOptions = presetOptions?.mdxPluginOptions as CompileOptions;

  return {
    name: 'storybook:mdx-plugin',
    enforce: 'pre',
    async transform(src, id) {
      if (!filter(id)) {
        return undefined;
      }

      const mdxLoaderOptions: CompileOptions = await presets.apply('mdxLoaderOptions', {
        ...mdxPluginOptions,
        mdxCompileOptions: {
          providerImportSource: join(
            dirname(require.resolve('@storybook/addon-docs/package.json')),
            '/dist/shims/mdx-react-shim.js'
          ),
          ...mdxPluginOptions?.mdxCompileOptions,
          rehypePlugins: [
            ...(mdxPluginOptions?.mdxCompileOptions?.rehypePlugins ?? []),
            rehypeSlug,
            rehypeExternalLinks,
          ],
        },
      });

      const code = String(await compile(src, mdxLoaderOptions));

      return {
        code,
        // TODO: support source maps
        map: null,
      };
    },
  };
}
