import type { StorybookConfig } from '@storybook/svelte-vite';
import type { SvelteConfig } from '@sveltejs/vite-plugin-svelte';

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  const { plugins = [] } = config;
  const { presets } = options;

  let addonPluginConfig: SvelteConfig = {};

  try {
    const { loadSvelteConfig } = await import('@sveltejs/vite-plugin-svelte');

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

  const addonPlugin = (await import('./vite/plugin.js')).default;

  plugins.push(addonPlugin(addonPluginConfig));

  return {
    ...config,
    plugins,
  };
};
