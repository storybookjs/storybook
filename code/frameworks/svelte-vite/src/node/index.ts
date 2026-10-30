import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererAddon,
  type Storybook,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { svelte, type SvelteTypes } from '@storybook/svelte/node';
import { assertSvelteCsfAddonNotInstalledOnInstance } from '@storybook/svelte/internal/svelte-csf/addon-check';

import type { FrameworkOptions, StorybookConfig as SvelteViteConfig } from '../types.ts';
import { withSveltePlugins } from '../vite-plugins.ts';

export type { FrameworkOptions };

/** Configure Svelte Vite with native addons or preset entries. */
export type StorybookConfig = Omit<SvelteViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the Svelte renderer with an isolated Vite builder. */
export const svelteVite = defineFramework<
  '@storybook/svelte-vite',
  FrameworkOptions | void,
  RendererAddon<SvelteTypes>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/svelte-vite' },
    builder: vite(options.builder),
    renderer: svelte(),
    setup(storybook): void {
      svelteViteHooks(storybook, options, '@storybook/svelte-vite');
      storybook.hook('core:framework:extend', () => ({
        name: '@storybook/svelte-vite',
        options,
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
    },
  };
});

export default svelteVite;

/** Register the Svelte renderer entry and Vite plugins for frameworks that build on it. */
export function svelteViteHooks(
  storybook: Storybook,
  options: FrameworkOptions,
  frameworkName: string
): void {
  storybook.hook('core:config:extend', (value) => ({
    ...value,
    renderer: import.meta.resolve('@storybook/svelte/node'),
  }));
  storybook.hook('builder:vite:extend', (config) => {
    assertSvelteCsfAddonNotInstalledOnInstance({ storybook, framework: frameworkName });
    return withSveltePlugins(config, {
      frameworkName,
      docgen: storybook.options.docs?.builderDocgen === false ? false : options.docgen,
    });
  });
}

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
