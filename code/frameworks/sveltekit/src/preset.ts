import { fileURLToPath } from 'node:url';

import type { PresetProperty } from 'storybook/internal/types';

import { withoutVitePlugins } from '@storybook/builder-vite';
import { viteFinal as svelteViteFinal } from '@storybook/svelte-vite/preset';

import { configOverrides } from './plugins/config-overrides';
import { mockSveltekitStores } from './plugins/mock-sveltekit-stores';
import { type StorybookConfig } from './types';

export const core: PresetProperty<'core'> = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/svelte/preset'),
};
export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  fileURLToPath(import.meta.resolve('@storybook/sveltekit/preview')),
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

export const optimizeViteDeps = [
  '@storybook/sveltekit/internal/mocks/app/forms',
  '@storybook/sveltekit/internal/mocks/app/navigation',
  '@storybook/sveltekit/internal/mocks/app/stores',
  '@storybook/sveltekit/internal/mocks/app/state.svelte.js',
];
