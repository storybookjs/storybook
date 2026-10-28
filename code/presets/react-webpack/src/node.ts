import { defineAddon } from '@storybook/core';

// Declares the `builder:webpack:extend` hook for typing only.
import type {} from '@storybook/builder-webpack5/node';

import { withReactDocgen } from './react-docgen.ts';
import type { TypescriptOptions } from './types.ts';

/** Add React builder docgen to the Webpack preview when server docgen is off. */
export const presetReactWebpack = defineAddon<void>(() => ({
  meta: { name: '@storybook/preset-react-webpack' },
  setup(storybook): void {
    storybook.hook('builder:webpack:extend', async (config) =>
      withReactDocgen(config, {
        features: storybook.options.features,
        typescript: (await storybook.callHook(
          'core:typescript:extend',
          {}
        )) as Partial<TypescriptOptions>,
        debug: storybook.options.loglevel === 'debug',
      })
    );
  },
}));

export default presetReactWebpack;
