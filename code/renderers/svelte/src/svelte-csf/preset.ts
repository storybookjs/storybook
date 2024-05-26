import type { StorybookConfig } from '@storybook/svelte-vite';

import { preTransformPlugin } from './compiler/pre-transform.js';
import { postTransformPlugin } from './compiler/post-transform.js';
import { indexer } from './indexer/index.js';

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {

  return {
    ...config,
    plugins: [
      preTransformPlugin(),
      ...(config.plugins ?? []),
      postTransformPlugin(),
    ],
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [indexer, ...(indexers || [])];
};
