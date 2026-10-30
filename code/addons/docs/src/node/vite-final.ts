import './hooks.ts';

import { isAbsolute } from 'node:path';

import type { Storybook } from '@storybook/core';

import { vite as csfPluginVite } from '../csf-plugin/index.ts';
import type { DocsOptions } from './options.ts';
import { getResolvedReact } from './resolved-react.ts';

/** Add MDX compilation, CSF enrichment, and react deduplication to the Vite config. */
export async function extendViteConfig(
  storybook: Pick<Storybook, 'callHook' | 'options'>,
  config: any,
  { csfPluginOptions = {} }: DocsOptions
): Promise<any> {
  const { plugins = [] } = config;

  const enrichCsf = await storybook.callHook('legacy:experimental_enrichCsf:extend', undefined);

  if (csfPluginOptions) {
    plugins.unshift(
      csfPluginVite({
        ...csfPluginOptions,
        enrichCsf,
      })
    );
  }

  if (storybook.options.docs?.mdx === false) {
    return { ...config, plugins };
  }

  const { mdxPlugin } = await import('../mdx-plugin.ts');
  const { react, reactDom, mdx } = await getResolvedReact(storybook);

  const packageDeduplicationPlugin = {
    name: 'storybook:package-deduplication',
    enforce: 'pre',
    config: () => ({
      resolve: {
        alias: {
          react,
          // Vite ignores export maps when resolving an absolute path.
          ...(isAbsolute(reactDom) && { 'react-dom/server': `${reactDom}/server.browser.js` }),
          'react-dom': reactDom,
          '@mdx-js/react': mdx,
        },
      },
    }),
  };

  // First, so aliases from later plugins (e.g. preact's) override these.
  plugins.unshift(packageDeduplicationPlugin);
  // MDX must compile before any react plugin transforms it.
  plugins.unshift(await mdxPlugin(storybook));

  return {
    ...config,
    plugins,
  };
}
