import type { Options } from 'storybook/internal/types';

import type { Server } from 'http';

import { getAssetsInclude } from './assetsInclude';
import { sanitizeEnvVars } from './envs';
import { getOptimizeDeps } from './optimizeDeps';
import { commonConfig } from './vite-config';

export async function createViteServer(options: Options, devServer: Server) {
  const { presets } = options;

  const commonCfg = await commonConfig(options, 'development');

  const config = {
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

  const finalConfig = await presets.apply('viteFinal', config, options);

  const { createServer } = await import('vite');
  return createServer(await sanitizeEnvVars(options, finalConfig));
}
