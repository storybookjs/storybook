import {
  defineFramework,
  type RendererPlugin,
  type StorybookConfig as InstanceConfig,
} from '@storybook/core';

import { webpack } from '@storybook/builder-webpack5/node';
import { serverWebpack } from '@storybook/preset-server-webpack/node';
import { server } from '@storybook/server/node';

import type { FrameworkOptions, StorybookConfig as ServerWebpackConfig } from '../types.ts';

/** Configure Server Webpack with native addons or preset entries. */
export type StorybookConfig = Omit<ServerWebpackConfig, 'addons'> & Pick<InstanceConfig, 'addons'>;

/** Compose the server renderer with an isolated Webpack builder. */
export const serverWebpack5 = defineFramework<
  FrameworkOptions | void,
  RendererPlugin,
  readonly [ReturnType<typeof serverWebpack>]
>((input) => {
  const options = input || {};
  return {
    meta: { name: '@storybook/server-webpack5' },
    builder: webpack(options.builder),
    renderer: server(),
    addons: [serverWebpack()],
    setup(storybook): void {
      storybook.hook('core:config:extend', (value) => ({
        ...value,
        renderer: import.meta.resolve('@storybook/server/node'),
      }));
      storybook.hook('core:framework:extend', () => ({
        name: '@storybook/server-webpack5',
        options,
      }));
      storybook.hook('core:framework-options:extend', () => ({ ...options }));
    },
  };
});

export default serverWebpack5;

/** Define the main configuration. */
export function defineMain<const T extends StorybookConfig>(config: T): T {
  return config;
}
