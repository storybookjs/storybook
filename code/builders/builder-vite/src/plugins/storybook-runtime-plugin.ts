import { globalsNameReferenceMap } from 'storybook/internal/preview/globals';
import type { Builder_EnvsRaw } from 'storybook/internal/types';
import type { Options } from 'storybook/internal/types';

import type { Plugin } from 'vite';

import { stringifyProcessEnvs } from '../envs';
import { externalGlobalsPlugin } from './external-globals-plugin';

/**
 * Options for the Storybook runtime plugin.
 *
 * This plugin injects necessary globals and environment variables for Storybook's runtime. It is
 * designed to be shared between `@storybook/builder-vite` and `@storybook/addon-vitest`.
 */
export interface StorybookRuntimePluginOptions {
  /**
   * Map of external module names to their global variable reference names.
   *
   * Storybook preview modules are pre-bundled and exposed as globals at runtime. This map tells the
   * plugin how to transform imports of those modules into destructured global variable references.
   *
   * @example
   *
   * ```
   * { "storybook/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__" }
   * ```
   */
  externals: Record<string, string>;

  /**
   * Pre-resolved environment variables to inject as `import.meta.env.*` defines.
   *
   * When provided, these are filtered by the resolved `envPrefix` from the Vite config and injected
   * into Vite's `define` option.
   *
   * This allows callers to resolve env vars from their own source (e.g., Storybook presets) and
   * pass them in without the plugin needing access to the presets system.
   */
  envs?: Builder_EnvsRaw;
}

/**
 * A composite Vite plugin that injects necessary globals and environment variables for Storybook's
 * runtime.
 *
 * This handles:
 *
 * - Transforming imports of pre-bundled Storybook preview modules to global variable references
 *   (e.g., `import { useMemo } from 'storybook/preview-api'` becomes `const { useMemo } =
 *   __STORYBOOK_MODULE_PREVIEW_API__`)
 * - Setting up dev-mode aliases for external modules
 * - Injecting environment variables as `import.meta.env.*` defines
 *
 * @returns An array of Vite plugins
 */
export async function storybookRuntimePlugin(options: Options): Promise<Plugin[]> {
  const plugins: Plugin[] = [await externalGlobalsPlugin(globalsNameReferenceMap)];
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
