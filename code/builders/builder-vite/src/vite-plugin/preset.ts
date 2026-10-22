import type { Options } from 'storybook/internal/types';

import type { InlineConfig, ServerOptions } from 'vite';

/** Namespaced to avoid colliding with Storybook's own options. */
export type VitePluginPresetOptions = {
  /** Host Vite settings forwarded to the preview. */
  vitePlugin: {
    /** Preview base: `/__storybook/` when embedded and `/` in Storybook mode. */
    base: string;
    /** A separate preview HMR path on the shared HTTP server. */
    hmrPath: string;
    /** Match the host server's accepted `Host` headers. */
    allowedHosts?: ServerOptions['allowedHosts'];
  };
};

export const viteFinal = (
  config: InlineConfig,
  { vitePlugin }: Options & VitePluginPresetOptions
): InlineConfig => ({
  ...config,
  base: vitePlugin.base,
  server: {
    ...config.server,
    allowedHosts: vitePlugin.allowedHosts ?? config.server?.allowedHosts,
    hmr: {
      ...(typeof config.server?.hmr === 'object' ? config.server.hmr : {}),
      path: vitePlugin.hmrPath,
    },
  },
});
