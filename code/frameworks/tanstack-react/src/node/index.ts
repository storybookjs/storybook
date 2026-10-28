import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { reactViteHooks, type ReactViteOptions } from '@storybook/react-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type { FrameworkOptions, StorybookConfig as TanStackReactConfig } from '../types.ts';
import { getPreviewAnnotations, OPTIMIZE_VITE_DEPS, withTanStack } from '../vite-final.ts';

/** Configure TanStack React with native addons or preset entries. */
export type StorybookConfig = Omit<TanStackReactConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder, TanStack integration, and React preview docgen. */
export interface TanStackReactOptions extends FrameworkOptions, Pick<ReactViteOptions, 'docgen'> {}

/** Compose the React renderer and the TanStack integration with an isolated Vite builder. */
export const tanstackReact = defineFramework<
  TanStackReactOptions | void,
  RendererPlugin<ReactTypes>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/tanstack-react' },
    builder: vite(options.builder),
    renderer: react(),
    setup(storybook): void {
      reactViteHooks(storybook, options);
      // The legacy preset copies the framework's builder options into `core`.
      storybook.hook('core:config:extend', (core) => ({
        ...core,
        builder: {
          name: import.meta.resolve('@storybook/builder-vite'),
          options: options.builder ?? {},
        },
      }));
      storybook.hook('core:framework:extend', () => ({
        name: '@storybook/tanstack-react',
        options,
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
      storybook.hook('preview:annotations:collect', () => getPreviewAnnotations());
      storybook.hook('builder:vite-deps:collect', () => OPTIMIZE_VITE_DEPS);
      storybook.hook('builder:vite:extend', (config) => withTanStack(config));
    },
  };
});

export default tanstackReact;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
