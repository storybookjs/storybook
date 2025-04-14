```ts filename="vite-server.ts" renderer="common" language="ts"
import { stringifyProcessEnvs } from './envs';
import { getOptimizeDeps } from './optimizeDeps';
import { commonConfig } from './vite-config';

import type { EnvsRaw, ExtendedOptions } from './types';

export async function createViteServer(options: ExtendedOptions, devServer: Server) {
  const { port, presets } = options;

  // Defines the baseline config.
  const baseConfig = await commonConfig(options, 'development');
  const defaultConfig = {
    ...baseConfig,
    server: {
      middlewareMode: true,
      hmr: {
        port,
        server: devServer,
      },
      fs: {
        strict: true,
      },
    },
    optimizeDeps: await getOptimizeDeps(baseConfig, options),
  };

  const finalConfig = await presets.apply('viteFinal', defaultConfig, options);

  const envsRaw = await presets.apply<Promise<EnvsRaw>>('env');

  // Remainder implementation
}
```
