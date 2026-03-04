import type { Server } from 'http';
import type { Options } from '@storybook/types';
import { commonConfig } from './vite-config';
import { getOptimizeDeps } from './optimizeDeps';
import { sanitizeEnvVars } from './envs';

export async function createViteServer(options: Options, devServer: Server) {
  const { presets } = options;

  const commonCfg = await commonConfig(options, 'development');

  const { allowedHosts } = await presets.apply('core', {});

  const config = {
    ...commonCfg,
    // Needed in Vite 5: https://github.com/storybookjs/storybook/issues/25256
    assetsInclude: ['/sb-preview/**'],
    // Set up dev server
    server: {
      allowedHosts,
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

  // '0.0.0.0' binds to all interfaces, which is useful for Docker and other containerized environments
  if (
    options.host === '0.0.0.0' &&
    (!allowedHosts || (Array.isArray(allowedHosts) && allowedHosts.length === 0))
  ) {
    config.server.allowedHosts = true;
  }

  const finalConfig = await presets.apply('viteFinal', config, options);

  const { createServer } = await import('vite');
  return createServer(await sanitizeEnvVars(options, finalConfig));
}
