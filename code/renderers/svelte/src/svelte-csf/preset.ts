import type { StorybookConfig } from '@storybook/svelte-vite';

import { plugin } from './compiler/plugin';
import { indexer } from './indexer/index';

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  return {
    ...config,
    plugins: [...(config.plugins ?? []), plugin()],
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [indexer, ...(indexers || [])];
};
