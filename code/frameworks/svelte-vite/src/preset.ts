import type { PresetProperty } from 'storybook/internal/types';

import { svelteDocgen } from './plugins/svelte-docgen';
import type { FrameworkOptions, StorybookConfig } from './types';
import { handleSvelteKit } from './utils';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/svelte/preset'),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const { plugins = [] } = config;

  // Get framework options to check if docgen is disabled
  const framework = await options.presets.apply('framework');
  const frameworkOptions: FrameworkOptions =
    typeof framework === 'string' ? {} : (framework.options ?? {});

  // Check if docgen is disabled in framework options (default is true/enabled)
  if (frameworkOptions.docgen !== false) {
    plugins.push(await svelteDocgen());
  }

  await handleSvelteKit(plugins, options);

  return {
    ...config,
    plugins,
  };
};
