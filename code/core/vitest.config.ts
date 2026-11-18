import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { defineConfig, mergeConfig } from 'vitest/config';

import { textAssetLoaderPlugins, vitestCommonConfig } from '../vitest.shared.ts';

const require = createRequire(import.meta.url);
const polkaUrlEsm = join(dirname(require.resolve('@polka/url/package.json')), 'build.mjs');

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    plugins: [...textAssetLoaderPlugins],
    resolve: {
      // Nested @polka/url@0.5.0 is CJS and breaks polka's named `parse` import.
      // Absolute path: `@polka/url/build.mjs` is not in the package exports map.
      alias: {
        '@polka/url': polkaUrlEsm,
      },
    },
    test: {
      name: 'core',
      // Some files still depend on running in a fresh worker; see `isolate` in vitest.shared.ts.
      isolate: true,
      typecheck: {
        enabled: true,
      },
      server: {
        deps: {
          // Inline so the `@polka/url` alias applies to polka's own import graph.
          inline: ['polka', '@polka/url'],
        },
      },
      benchmark: {
        include: ['**/*.bench.ts'],
      },
    },
  })
);
