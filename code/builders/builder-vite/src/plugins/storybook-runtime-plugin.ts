import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type { Builder_EnvsRaw } from 'storybook/internal/types';
import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { stringifyProcessEnvs } from '../envs';
import { externalGlobalsPlugin } from './external-globals-plugin';

export interface StorybookRuntimePluginOptions {
  externals: Record<string, string>;
  envs?: Builder_EnvsRaw;
}

/**
 * A composite Vite plugin that injects necessary globals and environment variables for Storybook's
 * runtime.
 */
export async function storybookRuntimePlugin(options: Options): Promise<Plugin[]> {
  const build = await options.presets.apply('build');

  const externals: typeof globalsNameReferenceMap & Record<string, string> =
    globalsNameReferenceMap;

  if (build?.test?.disableBlocks) {
    externals['@storybook/addon-docs/blocks'] = '__STORYBOOK_BLOCKS_EMPTY_MODULE__';
  }

  const plugins: Plugin[] = [await externalGlobalsPlugin(externals)];
  const envs = await options.presets.apply<Builder_EnvsRaw>('env');

  if (envs && Object.keys(envs).length > 0) {
    plugins.push({
      name: 'storybook:env-plugin',
      config(config) {
        const envDefines = stringifyProcessEnvs(envs, config.envPrefix);
        return {
          define: envDefines,
        };
      },
    });
  }

  return plugins;
}
