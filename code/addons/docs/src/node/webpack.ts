import './hooks.ts';

import { fileURLToPath } from 'node:url';

import type { Storybook } from '@storybook/core';
import { logger } from '@storybook/core/internal/node-logger';

import type { CompileOptions } from '../compiler/index.ts';
import { webpack as csfPluginWebpack } from '../csf-plugin/index.ts';
import type { DocsOptions } from './options.ts';
import { getResolvedReact } from './resolved-react.ts';

/** Add the MDX loader, CSF enrichment, and react singletons to the Webpack config. */
export async function extendWebpackConfig(
  storybook: Pick<Storybook, 'callHook'>,
  webpackConfig: any = {},
  { csfPluginOptions = {}, mdxPluginOptions = {} }: DocsOptions
): Promise<any> {
  const { module = {} } = webpackConfig;

  const enrichCsf = await storybook.callHook('legacy:experimental_enrichCsf:extend', undefined);

  const rehypeSlug = (await import('rehype-slug')).default;
  const rehypeExternalLinks = (await import('rehype-external-links')).default;

  const mdxLoaderOptions: CompileOptions = await storybook.callHook(
    'legacy:mdxLoaderOptions:extend',
    {
      ...mdxPluginOptions,
      mdxCompileOptions: {
        providerImportSource: fileURLToPath(
          import.meta.resolve('@storybook/addon-docs/mdx-react-shim')
        ),
        ...mdxPluginOptions.mdxCompileOptions,
        rehypePlugins: [
          ...(mdxPluginOptions?.mdxCompileOptions?.rehypePlugins ?? []),
          rehypeSlug,
          rehypeExternalLinks,
        ],
      },
    }
  );

  logger.info(`Addon-docs: using MDX3`);

  const { react, reactDom, mdx } = await getResolvedReact(storybook);

  // Docs blocks need single react and emotion instances to render.
  let alias;
  if (Array.isArray(webpackConfig.resolve?.alias)) {
    alias = [...webpackConfig.resolve?.alias];
    alias.push(
      {
        name: 'react',
        alias: react,
      },
      {
        name: 'react-dom',
        alias: reactDom,
      },
      {
        name: '@mdx-js/react',
        alias: mdx,
      }
    );
  } else {
    alias = {
      ...webpackConfig.resolve?.alias,
      react,
      'react-dom': reactDom,
      '@mdx-js/react': mdx,
    };
  }

  return {
    ...webpackConfig,
    plugins: [
      ...(webpackConfig.plugins || []),

      ...(csfPluginOptions
        ? [
            csfPluginWebpack({
              ...csfPluginOptions,
              enrichCsf,
            }),
          ]
        : []),
    ],
    resolve: {
      ...webpackConfig.resolve,
      alias,
    },
    module: {
      ...module,
      rules: [
        ...(module.rules || []),
        {
          test: /\.mdx$/,
          exclude: /(stories|story)\.mdx$/,
          use: [
            {
              loader: fileURLToPath(import.meta.resolve('@storybook/addon-docs/mdx-loader')),
              options: mdxLoaderOptions,
            },
          ],
        },
      ],
    },
  };
}
