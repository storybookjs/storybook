import type { StorybookConfig } from '@storybook/svelte-vite';

import { postTransformPlugin, preTransformPlugin } from '#compiler/plugins';
import { indexer } from '#indexer/index';

export const viteFinal: StorybookConfig['viteFinal'] = async (config, options) => {
  return {
    ...config,
    plugins: [
      /** TODO: Is this the place for `options.supportLegacy`? */
      preTransformPlugin(),
      ...(config.plugins ?? []),
      postTransformPlugin(),
    ],
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [indexer, ...(indexers || [])];
};
