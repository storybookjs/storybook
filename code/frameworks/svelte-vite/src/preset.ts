import type { PresetProperty } from 'storybook/internal/types';

import { assertSvelteCsfAddonNotInstalled } from '@storybook/svelte/internal/svelte-csf/addon-check';

import { svelteCsf } from './plugins/svelte-csf.ts';
import { resolveDocgenContext } from './docgen/options.ts';
import { svelteDocgen } from './plugins/svelte-docgen.ts';
import type { StorybookConfig } from './types.ts';
import { handleSvelteKit } from './utils.ts';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/svelte/preset'),
};

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const { plugins = [] } = config;
  const framework = await options.presets.apply('framework');

  assertSvelteCsfAddonNotInstalled({ presetsList: options.presetsList, framework });

  const { docgen, docgenServerActive } = await resolveDocgenContext(options);
  if (docgen && !docgenServerActive) {
    plugins.push(await svelteDocgen());
  }

  await handleSvelteKit(plugins, options);
  plugins.push(svelteCsf());

  return {
    ...config,
    plugins,
  };
};
