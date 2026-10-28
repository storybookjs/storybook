import './hooks.ts';

import type { Storybook } from '@storybook/core';

import type { Server } from 'node:http';
import type { InlineConfig, ServerOptions, ViteDevServer } from 'vite';

import { createViteLogger } from './logger.ts';
import { commonConfig, getViteHookContext, type ViteConfigInput } from './vite-config.ts';

export async function createViteServer(
  storybook: Storybook,
  input: ViteConfigInput & { server?: Server }
): Promise<ViteDevServer> {
  const { port, host } = storybook.options;
  const [commonCfg, core] = await Promise.all([
    commonConfig(storybook, input, 'development'),
    storybook.callHook('core:config:extend', undefined),
  ]);
  const allowedHosts = core?.allowedHosts;

  const config: InlineConfig & { server: ServerOptions } = {
    ...commonCfg,
    server: {
      allowedHosts,
      middlewareMode: true,
      // Without a host server, Vite would otherwise open its own WebSocket port for HMR.
      ...(input.server ? { hmr: { port, server: input.server } } : { hmr: false, ws: false }),
      fs: {
        strict: true,
      },
    },
    appType: 'custom' as const,
  };

  // '0.0.0.0' binds to all interfaces, which is useful for Docker and other containerized environments
  if (
    host === '0.0.0.0' &&
    (!allowedHosts || (Array.isArray(allowedHosts) && allowedHosts.length === 0))
  ) {
    config.server.allowedHosts = true;
  }

  const finalConfig = await storybook.callHook(
    'builder:vite:extend',
    config,
    getViteHookContext(storybook)
  );

  const { createServer } = await import('vite');

  finalConfig.customLogger ??= await createViteLogger();
  return createServer(finalConfig);
}
