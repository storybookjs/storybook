import { isPreservingSymlinks } from 'storybook/internal/common';

import { type Plugin } from 'vite';

export interface StorybookConfigPluginOptions {
  configDir: string;
}

/**
 * A Vite plugin that provides the base Storybook configuration.
 *
 * This handles:
 *
 * - Adding Storybook resolve conditions (`storybook`, `stories`, `test`)
 * - Setting up environment variable prefixes (`VITE_`, `STORYBOOK_`)
 * - Allowing the Storybook config directory in Vite's filesystem restrictions
 * - Preserving symlinks when applicable
 */
export function storybookConfigPlugin(options: StorybookConfigPluginOptions): Plugin[] {
  return [
    {
      name: 'storybook:config-plugin',
      enforce: 'pre',
      async config(config) {
        const { defaultClientConditions = [] } = await import('vite');

        const existingEnvPrefix = config.envPrefix;
        const mergedEnvPrefix = existingEnvPrefix
          ? Array.from(
              new Set([
                ...(Array.isArray(existingEnvPrefix) ? existingEnvPrefix : [existingEnvPrefix]),
                'STORYBOOK_',
              ])
            )
          : ['VITE_', 'STORYBOOK_'];

        return {
          resolve: {
            conditions: ['storybook', 'stories', 'test', ...defaultClientConditions],
            preserveSymlinks: isPreservingSymlinks(),
          },
          envPrefix: mergedEnvPrefix,
        };
      },
    },
    {
      name: 'storybook:allow-storybook-dir',
      enforce: 'post',
      config(config) {
        if (config?.server?.fs?.allow) {
          config.server.fs.allow.push(options.configDir);
        }
      },
    },
  ];
}
