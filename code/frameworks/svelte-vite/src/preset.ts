import type { PresetProperty } from 'storybook/internal/types';

import { svelteDocgen } from './plugins/svelte-docgen';
import type { StorybookConfig } from './types';
import { handleSvelteKit } from './utils';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/svelte/preset'),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const { plugins = [] } = config;

  // Check if docgen is disabled in main config
  const docgenEnabled = await options.presets.apply('docgen');
  if (docgenEnabled !== false) {
    plugins.push(await svelteDocgen());
  }

  await handleSvelteKit(plugins, options);

  return {
    ...config,
    plugins,
  };
};
