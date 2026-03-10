import type { Builder_EnvsRaw } from 'storybook/internal/types';
import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { stringifyProcessEnvs } from '../envs';

export interface StorybookRuntimePluginOptions {
  externals: Record<string, string>;
  envs?: Builder_EnvsRaw;
}

/** A composite Vite plugin that injects environment variables for Storybook's runtime. */
export async function storybookSanitizeEnvs(options: Options): Promise<Plugin[]> {
  const plugins: Plugin[] = [];
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
