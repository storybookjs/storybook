import { resolve } from 'node:path';

import { isPreservingSymlinks, resolvePathInStorybookCache } from 'storybook/internal/common';

import type { Plugin } from 'vite';

/**
 * Options for the Storybook config plugin.
 *
 * This plugin provides the base Storybook-specific Vite configuration, including resolve
 * conditions, environment variable prefixes, and filesystem access rules. It is designed to be
 * shared between `@storybook/builder-vite` and `@storybook/addon-vitest`.
 */
export interface StorybookConfigPluginOptions {
  /** The Storybook configuration directory (e.g., '.storybook') */
  configDir: string;
  /**
   * Cache key for the Vite cache directory. When set, cacheDir is resolved via Storybook's cache
   * using the `sb-vite` prefix. Omit to let the caller handle cache directory configuration.
   */
  cacheKey?: string;
  /**
   * Base public path for the Vite dev server. When set, overrides Vite's default base. For
   * builder-vite, this is typically './'. Omit to keep the existing base from the user's config.
   */
  base?: string;
  /**
   * Whether to set the Vite root to the parent of the config directory. Defaults to `true`. Set to
   * `false` when the root is managed externally (e.g., by vitest).
   */
  setRoot?: boolean;
}

/**
 * A Vite plugin that provides the base Storybook configuration.
 *
 * This handles:
 *
 * - Optionally setting the project root to the parent of the Storybook config directory
 * - Optionally configuring the Vite cache directory
 * - Adding Storybook resolve conditions (`storybook`, `stories`, `test`)
 * - Setting up environment variable prefixes (`VITE_`, `STORYBOOK_`)
 * - Allowing the Storybook config directory in Vite's filesystem restrictions
 * - Preserving symlinks when applicable
 */
export function storybookConfigPlugin(options: StorybookConfigPluginOptions): Plugin[] {
  const projectRoot = resolve(options.configDir, '..');

  return [
    {
      name: 'storybook:config-plugin',
      enforce: 'pre',
      async config(config) {
        const { defaultClientConditions = [] } = await import('vite');

        return {
          ...(options.cacheKey
            ? { cacheDir: resolvePathInStorybookCache('sb-vite', options.cacheKey) }
            : {}),
          ...(options.setRoot !== false ? { root: projectRoot } : {}),
          ...(options.base !== undefined ? { base: options.base } : {}),
          resolve: {
            conditions: ['storybook', 'stories', 'test', ...defaultClientConditions],
            preserveSymlinks: isPreservingSymlinks(),
          },
          // If an envPrefix is specified in the user's vite config, add STORYBOOK_ to it.
          // Otherwise, add both VITE_ and STORYBOOK_ so that Vite doesn't lose its default.
          envPrefix: config.envPrefix ? ['STORYBOOK_'] : ['VITE_', 'STORYBOOK_'],
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
