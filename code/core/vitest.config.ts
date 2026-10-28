import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { defineConfig, mergeConfig } from 'vitest/config';

import { textAssetLoaderPlugins, vitestCommonConfig } from '../vitest.shared.ts';
import buildConfig from './build-config.ts';

const require = createRequire(import.meta.url);
const polkaUrlEsm = join(dirname(require.resolve('@polka/url/package.json')), 'build.mjs');

// Deep entries built for both platforms resolve to their browser build here, as in a browser
// bundle, so the product annotations the setup registers stay free of Node-only setup code.
const browserDeepEntries = (buildConfig.entries.browser ?? []).flatMap(
  ({ exportEntries = [], entryPoint }) =>
    exportEntries
      .filter((key) =>
        buildConfig.entries.node?.some((entry) => entry.exportEntries?.includes(key))
      )
      .map((key) => ({
        find: `@storybook/core${key.slice(1)}`,
        replacement: new URL(
          entryPoint.replace('./src/', './dist/').replace(/\.tsx?$/, '.js'),
          import.meta.url
        ).pathname,
      }))
);

export default mergeConfig(
  vitestCommonConfig,
  defineConfig({
    plugins: [...textAssetLoaderPlugins],
    // oxc-parser / oxc-resolver ship `browser` entry points that import WASM bindings which
    // are not installed in this monorepo. Force Vite/Vitest to resolve them via their Node
    // entry points (index.js) during tests and benchmarks.
    resolve: {
      conditions: ['node'],
      mainFields: ['main'],
      // Nested @polka/url@0.5.0 is CJS and breaks polka's named `parse` import.
      // Absolute path: `@polka/url/build.mjs` is not in the package exports map.
      alias: [{ find: '@polka/url', replacement: polkaUrlEsm }, ...browserDeepEntries],
    },
    ssr: {
      external: ['oxc-parser', 'oxc-resolver'],
    },
    test: {
      name: 'core',
      setupFiles: ['../vitest-setup.split-packages.ts'],
      typecheck: {
        enabled: true,
      },
      server: {
        deps: {
          // Inline so the `@polka/url` alias applies to polka's own import graph.
          inline: ['polka', '@polka/url'],
          external: ['oxc-parser', 'oxc-resolver'],
        },
      },
      benchmark: {
        include: ['**/*.bench.ts'],
      },
    },
  })
);
