import { fileURLToPath } from 'node:url';

import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { svelteViteHooks } from '@storybook/svelte-vite/node';
import { svelte, type SvelteTypes } from '@storybook/svelte/node';

import {
  OPTIMIZE_VITE_DEPS,
  sveltekitStaticDirs,
  withSvelteKitPlugins,
} from '../framework-config.ts';
import type { FrameworkOptions, StorybookConfig as SvelteKitConfig } from '../types.ts';

export type { FrameworkOptions };

/** Configure SvelteKit with native addons or preset entries. */
export type StorybookConfig = Omit<SvelteKitConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the Svelte renderer with an isolated Vite builder and the SvelteKit plugins. */
export const sveltekit = defineFramework<
  '@storybook/sveltekit',
  FrameworkOptions | void,
  RendererPlugin<SvelteTypes>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/sveltekit' },
    builder: vite(options.builder),
    renderer: svelte(),
    setup(storybook): void {
      svelteViteHooks(storybook, options, '@storybook/sveltekit');
      storybook.hook('core:framework:extend', () => ({ name: '@storybook/sveltekit', options }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
      storybook.hook('preview:annotations:collect', () => [
        fileURLToPath(import.meta.resolve('@storybook/sveltekit/preview')),
      ]);
      storybook.hook('core:static-dirs:collect', () =>
        sveltekitStaticDirs({
          configDir: storybook.configDir,
          production: storybook.mode === 'build',
        })
      );
      storybook.hook('builder:vite:extend', (config) => withSvelteKitPlugins(config));
      storybook.hook('builder:vite-deps:collect', () => OPTIMIZE_VITE_DEPS);
    },
  };
});

export default sveltekit;

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
