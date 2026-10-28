import {
  defineFramework,
  type RendererPlugin,
  type Storybook,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import { withReactDocgen } from '../docgen-plugins.ts';
import type { FrameworkOptions, StorybookConfig as ReactViteConfig } from '../types.ts';

/** Configure React Vite with native addons or preset entries. */
export type StorybookConfig = Omit<ReactViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder, React rendering, and preview docgen. */
export interface ReactViteOptions extends FrameworkOptions {
  /** Choose preview docgen when server docgen is disabled. */
  docgen?: NonNullable<StorybookConfig['typescript']>['reactDocgen'];
}

/** Compose the React renderer with an isolated Vite builder. */
export const reactVite = defineFramework<ReactViteOptions | void, RendererPlugin<ReactTypes>>(
  (input) => {
    const options = input || {};
    return {
      meta: { name: '@storybook/react-vite' },
      builder: vite(options.builder),
      renderer: react(),
      setup(storybook): void {
        reactViteHooks(storybook, options);
        storybook.hook('core:framework:extend', () => ({ name: '@storybook/react-vite', options }));
        storybook.hook('core:framework-options:extend', () => ({ ...options }));
      },
    };
  }
);

export default reactVite;

/** Register the React Vite renderer, docgen, and Vite hooks for frameworks that build on it. */
export function reactViteHooks(storybook: Storybook, options: ReactViteOptions): void {
  storybook.hook('core:config:extend', (value) => ({
    ...value,
    renderer: import.meta.resolve('@storybook/react/node'),
  }));
  if (options.docgen !== undefined) {
    storybook.hook('core:typescript:extend', (value) => ({
      ...value,
      reactDocgen: options.docgen,
    }));
  }
  storybook.hook('builder:vite:extend', async (config) =>
    withReactDocgen(config, {
      features: storybook.options.features,
      typescript: await storybook.callHook('core:typescript:extend', {}),
    })
  );
}

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
