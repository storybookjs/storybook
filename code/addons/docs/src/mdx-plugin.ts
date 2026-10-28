import './node/hooks.ts';

import { fileURLToPath } from 'node:url';

import type { Storybook } from '@storybook/core';

import { createFilter } from '@rollup/pluginutils';
import type { Plugin } from 'vite';

import type { CompileOptions } from './compiler/index.ts';
import { compile } from './compiler/index.ts';

/**
 * Storybook uses a single loader when dealing with MDX:
 *
 * - *.mdx are compiled with the MDX compiler directly
 *
 * @see https://github.com/storybookjs/storybook/blob/next/addons/docs/docs/recipes.md#csf-stories-with-arbitrary-mdx
 */
export async function mdxPlugin(storybook: Pick<Storybook, 'callHook'>): Promise<Plugin> {
  const include = /\.mdx$/;
  const filter = createFilter(include);
  const presetOptions = await storybook.callHook('legacy:options:extend', {});
  const mdxPluginOptions = presetOptions?.mdxPluginOptions as CompileOptions;

  const rehypeSlug = (await import('rehype-slug')).default;
  const rehypeExternalLinks = (await import('rehype-external-links')).default;

  return {
    name: 'storybook:mdx-plugin',
    enforce: 'pre',
    transform: {
      filter: { id: include },
      async handler(src, id) {
        if (!filter(id)) {
          return undefined;
        }

        const mdxLoaderOptions = await storybook.callHook('legacy:mdxLoaderOptions:extend', {
          ...mdxPluginOptions,
          mdxCompileOptions: {
            providerImportSource: fileURLToPath(
              import.meta.resolve('@storybook/addon-docs/mdx-react-shim')
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
    },
  };
}
