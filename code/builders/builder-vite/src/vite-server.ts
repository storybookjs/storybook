import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import type { Server } from 'http';
import { dedent } from 'ts-dedent';
import type { InlineConfig, ServerOptions } from 'vite';

import { createViteLogger } from './logger';
import { getOptimizeDeps } from './optimizeDeps';
import { commonConfig } from './vite-config';

export async function createViteServer(options: Options, devServer: Server) {
  const { presets } = options;

  const commonCfg = await commonConfig(options, 'development');

  const optimizeDeps = await getOptimizeDeps(commonCfg);

  const config: InlineConfig & { server: ServerOptions } = {
    ...commonCfg,
    // Set up dev server
    optimizeDeps: {
      ...commonCfg.optimizeDeps,
      include: [...(commonCfg.optimizeDeps?.include || []), ...optimizeDeps.include],
    },
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
  };

  // '0.0.0.0' binds to all interfaces, which is useful for Docker and other containerized environments.
  // but without server.allowedHosts set, requests from outside the container will be rejected.
  if (options.host === '0.0.0.0' && !config.server.allowedHosts) {
    config.server.allowedHosts = true;
    logger.warn(dedent`'host' is set to '0.0.0.0' but 'allowedHosts' is not defined.
      Defaulting 'allowedHosts' to true, which permits all hostnames.
      To restrict allowed hostnames, add the following to your 'viteFinal' config:
      Example: { server: { allowedHosts: ['mydomain.com'] } }
      See:
      - https://vite.dev/config/server-options.html#server-allowedhosts
      - https://storybook.js.org/docs/api/main-config/main-config-vite-final
    `);
  }

  const finalConfig = await presets.apply('viteFinal', config, options);

  const { createServer } = await import('vite');

  finalConfig.customLogger ??= await createViteLogger();
  return createServer(finalConfig);
}
