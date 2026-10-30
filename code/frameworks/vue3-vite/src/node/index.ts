import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererAddon,
  type Storybook,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { vue, vueDocgenEngine, type VueTypes } from '@storybook/vue3/node';

import { withVueDocgen } from '../docgen-plugins.ts';
import { resolveDocgenOptions } from '../docgen/options.ts';
import type { FrameworkOptions, StorybookConfig as VueViteConfig } from '../types.ts';

/** Configure Vue Vite with native addons or preset entries. */
export type StorybookConfig = Omit<VueViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder and builder docgen. */
export type VueViteOptions = FrameworkOptions;

/** Compose the Vue renderer with an isolated Vite builder. */
export const vue3Vite = defineFramework<
  '@storybook/vue3-vite',
  VueViteOptions | void,
  RendererAddon<VueTypes>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/vue3-vite' },
    builder: vite(options.builder),
    renderer: vue(),
    setup(storybook): void {
      vue3ViteHooks(storybook, options);
      storybook.hook('core:framework:extend', () => ({ name: '@storybook/vue3-vite', options }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
    },
  };
});

export default vue3Vite;

/** Register the Vue renderer and Vite docgen hooks for frameworks that build on this one. */
export function vue3ViteHooks(storybook: Storybook, options: VueViteOptions): void {
  storybook.hook('core:config:extend', (value) => ({
    ...value,
    renderer: import.meta.resolve('@storybook/vue3/node'),
  }));
  storybook.hook('builder:vite:extend', (config) =>
    withVueDocgen(config, {
      docgen: resolveDocgenOptions(options.docgen),
      docgenServerActive: storybook.options.features?.docgenServer === true,
      disableDocgen:
        storybook.options.build?.test?.disableDocgen ||
        storybook.options.docs?.builderDocgen === false,
      getEngine: vueDocgenEngine,
    })
  );
}

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
