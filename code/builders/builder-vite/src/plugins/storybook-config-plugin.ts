import { isPreservingSymlinks, resolvePathInStorybookCache } from 'storybook/internal/common';

import type { Plugin } from 'vite';

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
        // If an envPrefix is specified in the user's vite config, add STORYBOOK_ to it.
        // Otherwise, add both VITE_ and STORYBOOK_ so that Vite doesn't lose its default.
        const mergedEnvPrefix = existingEnvPrefix
          ? Array.from(
              new Set([
                ...(Array.isArray(existingEnvPrefix) ? existingEnvPrefix : [existingEnvPrefix]),
                'STORYBOOK_',
              ])
            )
          : ['VITE_', 'STORYBOOK_'];

        return {
          cacheDir: resolvePathInStorybookCache('sb-vite'),
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
        // If there is NO allow list then Vite allows anything in the root directory.
        // If there IS an allow list then Vite only allows the listed directories.
        // We add the storybook config directory only if there's already an allow list,
        // to avoid disallowing the root unless it's already restricted.
        if (config?.server?.fs?.allow) {
          config.server.fs.allow.push(options.configDir);
        }
      },
    },
  ];
}
