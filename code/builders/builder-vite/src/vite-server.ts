import type { Server } from 'http';
import type { Options } from 'storybook/internal/types';
import { commonConfig } from './vite-config';
import { getOptimizeDeps } from './optimizeDeps';
import { sanitizeEnvVars } from './envs';
import { getAssetsInclude } from './assetsInclude';

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
    optimizeDeps: await getOptimizeDeps(commonCfg, options),
  };

  const finalConfig = await presets.apply('viteFinal', config, options);

  const { createServer } = await import('vite');
  return createServer(await sanitizeEnvVars(options, finalConfig));
}
