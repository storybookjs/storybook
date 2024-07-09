import type { StorybookConfig } from '@storybook/svelte-vite';
import type { Options } from '@storybook/types';

import { postTransformPlugin, preTransformPlugin } from '#compiler/plugins';
import { createIndexer } from '#indexer/index';

export interface StorybookAddonSvelteCsFOptions extends Options {
  /**
   * **Do you want to enable support for legacy code?**
   *
   * It will add overhead to the runtime, because it will trigger a pre-transform plugin,
   * which will run codemods to transform legacy syntax into modern.
   *
   * @default false
   */
  supportLegacy?: boolean;
}

export const viteFinal: StorybookConfig['viteFinal'] = async (
  config,
  options: StorybookAddonSvelteCsFOptions
) => {
  let { plugins = [], ...restConfig } = config;
  const { supportLegacy = false } = options;

  if (supportLegacy) {
    plugins.unshift(await preTransformPlugin());
  }
  plugins.push(await postTransformPlugin());

  return {
    ...restConfig,
    plugins,
  };
};

export const experimental_indexers: StorybookConfig['experimental_indexers'] = (
  indexers,
  options: StorybookAddonSvelteCsFOptions
) => {
  return [createIndexer(options.supportLegacy ?? false), ...(indexers || [])];
};
