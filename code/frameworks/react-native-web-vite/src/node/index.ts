import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { reactViteHooks, type ReactViteOptions } from '@storybook/react-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type { FrameworkOptions, StorybookConfig as ReactNativeWebViteConfig } from '../types.ts';
import { withReactNativeWeb } from '../vite-final.ts';

/** Configure React Native Web Vite with native addons or preset entries. */
export type StorybookConfig = Omit<ReactNativeWebViteConfig, 'addons'> &
  Pick<InstanceConfig, 'addons'>;

/** Configure the Vite builder, React Native Web transpilation, and React preview docgen. */
export interface ReactNativeWebViteOptions
  extends FrameworkOptions, Pick<ReactViteOptions, 'docgen'> {}

/** Compose the React renderer and React Native Web plugins with an isolated Vite builder. */
export const reactNativeWebVite = defineFramework<
  ReactNativeWebViteOptions | void,
  RendererPlugin<ReactTypes>
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/react-native-web-vite' },
    builder: vite(options.builder),
    renderer: react(),
    setup(storybook): void {
      reactViteHooks(storybook, options);
      storybook.hook('core:framework:extend', () => ({
        name: '@storybook/react-native-web-vite',
        options,
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
      storybook.hook('builder:vite:extend', (config) => withReactNativeWeb(config, options));
    },
  };
});

export default reactNativeWebVite;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
