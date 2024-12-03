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
    // Needed in Vite 5: https://github.com/storybookjs/storybook/issues/25256
    assetsInclude: getAssetsInclude(commonCfg, ['/sb-preview/**']),
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
  };

  const finalConfig = await presets.apply('viteFinal', config, options);

  // getOptimizeDeps calls resolveConfig internally, and should therefore
  // be invoked on the fully finalized configuration, in case viteFinal
  // has applied some changes that were necessary for the configuration
  // to be valid.
  const finalConfigWithDeps = {
    ...finalConfig,
    optimizeDeps: await getOptimizeDeps(finalConfig, options),
  };

  const { createServer } = await import('vite');
  return createServer(await sanitizeEnvVars(options, finalConfigWithDeps));
}
