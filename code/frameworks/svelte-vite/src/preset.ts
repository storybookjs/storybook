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

  plugins.push(await svelteDocgen(options));

  await handleSvelteKit(plugins, options);

  return {
    ...config,
    plugins,
  };
};
