import type { StorybookConfigVite } from '@storybook/builder-vite';
import type { Options, StorybookConfig } from 'storybook/internal/types';

import { transformPlugin, preTransformPlugin } from './compiler/plugins.ts';
import { createIndexer } from './indexer/index.ts';

export interface StorybookAddonSvelteCsFOptions extends Options {
  /**
   * Enable support for legacy templating.
   * This option is deprecated, it will be removed in a future major version and should only be used for gradual migration purposes.
   * Please migrate to the new snippet-based templating API when possible.
   *
   * Enabling this can slow down the build-performance because it requires more transformations.
   *
   * @default false
   * @deprecated
   */
  legacyTemplate?: boolean;
}

export const viteFinal: StorybookConfigVite['viteFinal'] = async (
  config,
  options: StorybookAddonSvelteCsFOptions
) => {
  const { plugins = [], ...restConfig } = config;
  const { legacyTemplate = false } = options;

  if (legacyTemplate) {
    plugins.unshift(await preTransformPlugin());
  }
  plugins.push(await transformPlugin());

  return {
    ...restConfig,
    plugins,
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (
  indexers,
  options: StorybookAddonSvelteCsFOptions
) => {
  return [createIndexer(options.legacyTemplate ?? false), ...(indexers || [])];
};

export const optimizeViteDeps = ['@storybook/svelte/csf'];
