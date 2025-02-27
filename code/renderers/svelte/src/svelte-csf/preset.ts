import type { StorybookConfig } from '@storybook/svelte-vite';
import type { Options } from 'storybook/internal/types';

import { transformPlugin, preTransformPlugin } from '$lib/compiler/plugins.js';
import { createIndexer } from '$lib/indexer/index.js';

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

export const viteFinal: StorybookConfig['viteFinal'] = async (
  config,
  options: StorybookAddonSvelteCsFOptions
) => {
  let { plugins = [], ...restConfig } = config;
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
