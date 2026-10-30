import {
  defineFramework,
  defineMain as coreDefineMain,
  type RendererAddon,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { vite } from '@storybook/builder-vite/node';
import { reactViteHooks } from '@storybook/react-vite/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type {
  ReactNativeWebViteOptions,
  StorybookConfig as ReactNativeWebViteConfig,
} from '../types.ts';
import { withReactNativeWeb } from '../vite-final.ts';

export type { ReactNativeWebViteOptions };

/** Configure React Native Web Vite with native addons or preset entries. */
export type StorybookConfig = Omit<ReactNativeWebViteConfig, 'addons'> &
  Pick<InstanceConfig, 'addons'>;

/** Compose the React renderer and React Native Web plugins with an isolated Vite builder. */
export const reactNativeWebVite = defineFramework<
  '@storybook/react-native-web-vite',
  ReactNativeWebViteOptions | void,
  RendererAddon<ReactTypes>
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

/** @deprecated Import defineMain from 'storybook'. */
export const defineMain: typeof coreDefineMain = coreDefineMain;
