import type { StorybookConfigVite } from '@storybook/builder-vite';
import type { StorybookConfig } from 'storybook/internal/types';

import { transformPlugin } from './compiler/plugins.ts';
import { createIndexer } from './indexer/index.ts';

export const viteFinal: StorybookConfigVite['viteFinal'] = async (config) => {
  const { plugins = [], ...restConfig } = config;

  plugins.push(await transformPlugin());

  return {
    ...restConfig,
    plugins,
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (indexers) => {
  return [createIndexer(), ...(indexers || [])];
};
