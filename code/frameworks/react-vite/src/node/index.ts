import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererPlugin,
  type Storybook,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import { withReactDocgen } from '../docgen-plugins.ts';
import type { ReactViteOptions, StorybookConfig as ReactViteConfig } from '../types.ts';

export type { ReactViteOptions };

/** Configure React Vite with native addons or preset entries. */
export type StorybookConfig = Omit<ReactViteConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the React renderer with an isolated Vite builder. */
export const reactVite = defineFramework<
  '@storybook/react-vite',
  ReactViteOptions | void,
  RendererPlugin<ReactTypes>
>((input) => {
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
});

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

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
