import { defineAddon } from '@storybook/core';

// Declares the `builder:webpack-config:extend` hook for typing only.
import type {} from '@storybook/builder-webpack5/node';

import { withServerLoaders } from './webpack-config.ts';

/** Load `*.stories.json` and `*.stories.yaml` files through Webpack. */
export const serverWebpack = defineAddon<void>(() => ({
  meta: { name: '@storybook/preset-server-webpack' },
  setup(storybook): void {
    storybook.hook('builder:webpack-config:extend', withServerLoaders);
  },
}));

export default serverWebpack;
