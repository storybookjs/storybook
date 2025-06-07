import type { Options } from 'storybook/internal/types';

import type { Server } from 'http';
import type { InlineConfig, ServerOptions } from 'vite';

import { sanitizeEnvVars } from './envs';
import { getOptimizeDeps } from './optimizeDeps';
import { commonConfig } from './vite-config';

export async function createViteServer(options: Options, devServer: Server) {
  const { presets } = options;

  const commonCfg = await commonConfig(options, 'development');

  const config: InlineConfig & { server: ServerOptions } = {
    ...commonCfg,
    // Set up dev server
    server: {
      middlewareMode: true,
      hmr: {
        port: options.port,
        server: devServer,
      },
      fs: {
        strict: true,
      },
    },
    appType: 'custom' as const,
    optimizeDeps: await getOptimizeDeps(commonCfg, options),
  };

  if (options.host && !config.server.allowedHosts) {
    // Regex to match IPv4 and IPv6 addresses, simplified is good enough
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$|^\[?([a-fA-F0-9:]+)\]?$/;

    if (ipRegex.test(options.host)) {
      // If options.host is set to an IP address then allow all hosts
      config.server.allowedHosts = true;
    } else {
      // Otherwise, allow only the specified or default host
      config.server.allowedHosts = [options.host.toLowerCase()];
    }
  }

  const finalConfig = await presets.apply('viteFinal', config, options);

  const { createServer } = await import('vite');
  return createServer(await sanitizeEnvVars(options, finalConfig));
}
