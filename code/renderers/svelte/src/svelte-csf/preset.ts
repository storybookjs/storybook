import type { StorybookConfig } from '@storybook/svelte-vite';

import { plugin } from './compiler/plugin.js';
import { indexer } from './indexer/index.js';

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  return {
    ...config,
    plugins: [...(config.plugins ?? []), plugin()],
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [indexer, ...(indexers || [])];
};
