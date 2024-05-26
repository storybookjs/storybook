import type { StorybookConfig } from '@storybook/svelte-vite';
import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';

import { preTransformPlugin } from './compiler/pre-transform.js';
import { postTransformPlugin } from './compiler/post-transform.js';
import { indexer } from './indexer/index.js';

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const { presets } = options;

  let addonPluginConfig: SvelteConfig = {};

  try {
    const { loadSvelteConfig } = await import('@sveltejs/vite-plugin-svelte');

    // TODO: remove support for svelteOptions from presets
    const [svelteConfig, svelteOptions] = await Promise.all([
      loadSvelteConfig(),
      presets.apply('svelteOptions', options),
    ]);

    addonPluginConfig = {
      ...svelteConfig,
      ...svelteOptions,
    };
  } catch (err: any) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log(
        '@sveltejs/vite-plugin-svelte not found. Unable to load config from svelte.config file'
      );
    } else {
      throw err;
    }
  }

  return {
    ...config,
    plugins: [
      preTransformPlugin(),
      ...(config.plugins ?? []),
      postTransformPlugin(addonPluginConfig),
    ],
  };
};


export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [indexer, ...(indexers || [])];
};
