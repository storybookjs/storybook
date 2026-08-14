import type { ChangeDetectionAdapter, ModuleResolveConfig } from 'storybook/internal/core-server';
import type { Options } from 'storybook/internal/types';

import { commonConfig } from '../vite-config.ts';

/**
 * Headless implementation of {@link ChangeDetectionAdapter}, for consumers that host the module
 * graph without a dev server (the `storybook tools` CLI).
 *
 * It assembles the same config the dev server would (`commonConfig` in development mode followed by
 * the `viteFinal` preset) and resolves it with Vite's server-less `resolveConfig`, so plugin
 * `config` hooks apply and `resolve.alias` / `resolve.conditions` / `root` come out normalised
 * exactly as the server-bound adapter snapshots them from `server.config`.
 *
 * There is no live builder, so `onFileChange` never fires: the consumer's graph is built once per
 * invocation and never needs invalidation.
 */
export function createHeadlessViteChangeDetectionAdapter(options: Options): ChangeDetectionAdapter {
  return {
    async getResolveConfig(): Promise<ModuleResolveConfig> {
      const { resolveConfig } = await import('vite');

      const config = await commonConfig(options, 'development');
      const finalConfig = await options.presets.apply('viteFinal', config, options);
      const resolved = await resolveConfig(finalConfig, 'serve', 'development');

      return {
        projectRoot: resolved.root,
        alias: resolved.resolve.alias as ModuleResolveConfig['alias'],
        conditions: resolved.resolve.conditions,
      };
    },

    onFileChange() {
      return () => {};
    },
  };
}
