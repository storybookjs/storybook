import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import { svelteDocgen } from './plugins/svelte-docgen';
import type { StorybookConfig } from './types';
import { handleSvelteKit } from './utils';

export const core: PresetProperty<'core'> = {
  builder: fileURLToPath(import.meta.resolve('@storybook/builder-vite')),
  renderer: fileURLToPath(import.meta.resolve('@storybook/svelte/preset')),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const { plugins = [] } = config;
  // TODO: set up eslint import to use typescript resolver

  const { loadSvelteConfig } = await import('@sveltejs/vite-plugin-svelte');
  const svelteConfig = await loadSvelteConfig();

  // Add docgen plugin
  plugins.push(await svelteDocgen(svelteConfig));

  await handleSvelteKit(plugins, options);

  return {
    ...config,
    plugins,
  };
};
