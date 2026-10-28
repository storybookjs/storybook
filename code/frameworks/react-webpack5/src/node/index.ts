import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { webpack } from '@storybook/builder-webpack5/node';
import { presetReactWebpack } from '@storybook/preset-react-webpack/node';
import { react, type ReactTypes } from '@storybook/react/node';

import type { FrameworkOptions, StorybookConfig as ReactWebpack5Config } from '../types.ts';
import { withReactWebpackConfig } from '../webpack-config.ts';

/** Configure React Webpack with native addons or preset entries. */
export type StorybookConfig = Omit<ReactWebpack5Config, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the React renderer with an isolated Webpack builder. */
export const reactWebpack5 = defineFramework<FrameworkOptions | void, RendererPlugin<ReactTypes>>(
  (input) => {
    const options = input || {};
    return {
      meta: { name: '@storybook/react-webpack5' },
      builder: webpack(options.builder),
      renderer: react(),
      addons: [presetReactWebpack()],
      setup(storybook): void {
        storybook.hook('core:config:extend', (value) => ({
          ...value,
          renderer: import.meta.resolve('@storybook/react/node'),
        }));
        storybook.hook('core:framework:extend', () => ({
          name: '@storybook/react-webpack5',
          options,
        }));
        storybook.hook('core:framework-options:extend', () => ({ ...options }));
        storybook.hook('builder:webpack-config:extend', (config) =>
          withReactWebpackConfig(config, storybook.options.features)
        );
      },
    };
  }
);

export default reactWebpack5;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
