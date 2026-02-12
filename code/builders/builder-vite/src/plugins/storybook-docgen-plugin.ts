import type { Options } from 'storybook/internal/types';

import { vite } from '@storybook/csf-plugin';

import type { Plugin } from 'vite';

/**
 * A Vite plugin that handles the extraction of component metadata (argTypes, descriptions) for
 * Storybook's documentation features.
 */
export async function storybookDocgenPlugin(options: Options): Promise<Plugin> {
  const { presets } = options;

  const addons = await presets.apply('addons', []);
  const docsOptions =
    // @ts-expect-error - not sure what type to use here
    addons.find((a) => [a, a.name].includes('@storybook/addon-docs'))?.options ?? {};

  const enrichCsf = await presets.apply('experimental_enrichCsf');

  return vite({
    ...docsOptions?.csfPluginOptions,
    enrichCsf,
  }) as Plugin;
}
