import type { Plugin, PluginOption } from 'vite';

import type { StorybookConfig } from './types';

export const core: StorybookConfig['core'] = {
  builder: import.meta.resolve('@storybook/builder-vite'),
  renderer: import.meta.resolve('@storybook/preact/preset'),
};

export const viteFinal: StorybookConfig['viteFinal'] = async (config) => {
  // TODO: Add docgen plugin per issue https://github.com/storybookjs/storybook/issues/19739
  return {
    ...config,
    plugins: patchPreactPlugins(config.plugins ?? []),
  };
};

/**
 * Patches @preact/preset-vite plugins to handle versions where the `config` hook accesses
 * `this.meta` or uses `'meta' in this` without guarding against null/undefined `this`.
 *
 * In Vite 6 and earlier, the plugin `config` hook may be called with `null` or `undefined` as
 * `this`. Some versions of @preact/preset-vite (specifically the `vite:preact-jsx` plugin) check
 * Rolldown support via `'meta' in this` or `this.meta.rolldownVersion` without a null guard,
 * causing: "TypeError: Cannot use 'in' operator to search for 'meta' in undefined/null".
 *
 * This workaround wraps the `config` hook to ensure `this` is always at least an empty object,
 * so the check degrades gracefully when the context is not available.
 */
function patchPreactPlugins(plugins: PluginOption[]): PluginOption[] {
  return plugins.map((plugin) => {
    if (Array.isArray(plugin)) {
      return patchPreactPlugins(plugin);
    }

    if (
      plugin &&
      typeof plugin === 'object' &&
      'name' in plugin &&
      plugin.name === 'vite:preact-jsx' &&
      'config' in plugin &&
      typeof plugin.config === 'function'
    ) {
      const originalConfig = plugin.config as (...args: unknown[]) => unknown;
      return {
        ...(plugin as Plugin),
        config(...args: unknown[]) {
          // Fall back to an empty object context so that `'meta' in this` evaluates to `false`
          // instead of throwing a TypeError when `this` is null or undefined.
          return originalConfig.apply(this ?? {}, args);
        },
      } as Plugin;
    }

    return plugin;
  });
}
