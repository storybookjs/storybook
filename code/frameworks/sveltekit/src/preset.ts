import { dirname, join } from 'node:path';

import type { PresetProperty } from 'storybook/internal/types';

import { withoutVitePlugins } from '@storybook/builder-vite';
// @ts-expect-error -- TS picks up the type from preset.js instead of dist/preset.d.ts
import { viteFinal as svelteViteFinal } from '@storybook/svelte-vite/preset';

import { configOverrides } from './plugins/config-overrides';
import { mockSveltekitStores } from './plugins/mock-sveltekit-stores';
import { type StorybookConfig } from './types';

const getAbsolutePath = <I extends string>(input: I): I =>
  dirname(require.resolve(join(input, 'package.json'))) as any;

export const core: PresetProperty<'core'> = {
  builder: getAbsolutePath('@storybook/builder-vite'),
  renderer: getAbsolutePath('@storybook/svelte'),
};
export const previewAnnotations: PresetProperty<'previewAnnotations'> = (entry = []) => [
  ...entry,
  join(dirname(require.resolve('@storybook/sveltekit/package.json')), 'dist/preview.js'),
];

export const viteFinal: NonNullable<StorybookConfig['viteFinal']> = async (config, options) => {
  const baseConfig = await svelteViteFinal(config, options);

  let { plugins = [] } = baseConfig;

  // disable specific plugins that are not compatible with Storybook
  plugins = (
    await withoutVitePlugins(plugins, [
      'vite-plugin-sveltekit-compile',
      'vite-plugin-sveltekit-guard',
    ])
  )
    .concat(configOverrides())
    .concat(await mockSveltekitStores());

  return { ...baseConfig, plugins };
};
