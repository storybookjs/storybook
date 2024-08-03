import type { Plugin } from 'vite';
import { vite } from '@storybook/csf-plugin';
import type { Options } from 'storybook/internal/types';

export async function csfPlugin(config: Options): Promise<Plugin> {
  const { presets } = config;

  const addons = await presets.apply('addons', []);
  const docsOptions =
    // @ts-expect-error - not sure what type to use here
    addons.find((a) => [a, a.name].includes('@storybook/addon-docs'))?.options ?? {};

  // TODO: looks like unplugin can return an array of plugins
  return vite(docsOptions?.csfPluginOptions) as Plugin;
}
