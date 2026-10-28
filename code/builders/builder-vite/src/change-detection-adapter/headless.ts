import '../hooks.ts';

import type { Storybook } from '@storybook/core';
import { StorybookPackageRequiredError } from '@storybook/core/internal/server-errors';
import type {
  ChangeDetectionAdapter,
  ModuleResolveConfig,
} from '@storybook/core/internal/services';

import type { BuilderOptions } from '../types.ts';
import { commonConfig, getViteHookContext } from '../vite-config.ts';

/**
 * Headless implementation of {@link ChangeDetectionAdapter}, for consumers that host the module
 * graph without a dev server (the `storybook tools` CLI).
 *
 * It resolves the dev server's config (`commonConfig` in development mode, then
 * `builder:vite:extend`) with Vite's server-less `resolveConfig`. `onFileChange` never fires.
 */
export function createHeadlessViteChangeDetectionAdapter(
  storybook: Storybook,
  options: BuilderOptions | undefined
): ChangeDetectionAdapter {
  return {
    async getResolveConfig(): Promise<ModuleResolveConfig> {
      const { resolveConfig } = await import('vite');
      // The preview runtime ships with `storybook`; load it lazily so the builder runs without it.
      const { getPreviewSources } = await import('storybook/internal/preview-page').catch(
        (error: unknown) => {
          throw new StorybookPackageRequiredError({
            feature: 'Headless Vite change detection',
            error,
          });
        }
      );

      const preview = await getPreviewSources(storybook, { hmr: 'vite' });
      const config = await commonConfig(storybook, { preview, options }, 'development');
      const finalConfig = await storybook.callHook(
        'builder:vite:extend',
        config,
        getViteHookContext(storybook)
      );
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
