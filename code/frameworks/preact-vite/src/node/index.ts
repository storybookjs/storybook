import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { preact } from '@storybook/preact/node';
import type { PreactRenderer } from '@storybook/preact/node';

import type { FrameworkOptions, StorybookConfig as PreactViteConfig } from '../types.ts';

/** Configure Preact Vite with native addons or preset entries. */
export type StorybookConfig = Omit<PreactViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder. */
export type PreactViteOptions = FrameworkOptions;

/** Compose the Preact renderer with an isolated Vite builder. */
export const preactVite = defineFramework<PreactViteOptions | void, RendererPlugin<PreactRenderer>>(
  (input) => {
    const options = input || {};
    return {
      meta: { name: '@storybook/preact-vite' },
      builder: vite(options.builder),
      renderer: preact(),
      setup(storybook): void {
        storybook.hook('core:config:extend', (value) => ({
          ...value,
          renderer: import.meta.resolve('@storybook/preact/node'),
        }));
        storybook.hook('core:framework:extend', () => ({
          name: '@storybook/preact-vite',
          options,
        }));
        storybook.hook('core:framework-options:extend', () => ({ ...options }));
      },
    };
  }
);

export default preactVite;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
