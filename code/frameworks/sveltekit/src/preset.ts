import type { PresetProperty } from 'storybook/internal/types';

import { withoutVitePlugins } from '@storybook/builder-vite';
import { viteFinal as svelteViteFinal } from '@storybook/svelte-vite/preset';

import { configOverrides } from './plugins/config-overrides';
import { mockSveltekitStores } from './plugins/mock-sveltekit-stores';
import { type StorybookConfig } from './types';

export const core: PresetProperty<'core'> = {
  builder: require.resolve('@storybook/builder-vite'),
  renderer: require.resolve('@storybook/svelte/preset'),
};
export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  require.resolve('@storybook/sveltekit/preview'),
];

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const baseConfig = await svelteViteFinal(config, options);

  return {
    ...baseConfig,
    plugins: [
      // disable specific plugins that are not compatible with Storybook
      ...(await withoutVitePlugins(baseConfig.plugins ?? [], [
        'vite-plugin-sveltekit-compile',
        'vite-plugin-sveltekit-guard',
      ])),
      configOverrides(),
      mockSveltekitStores(),
    ],
  };
};
