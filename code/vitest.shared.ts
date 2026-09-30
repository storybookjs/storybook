import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

/**
 * Loads .md/.html imports as text, matching the esbuild `loader` option in
 * scripts/build/utils/generate-bundle.ts. Used by the MCP packages, which
 * import instruction and template files as strings.
 */
export const textAssetLoaderPlugins: Plugin[] = ['.md', '.html'].map((extension) => ({
  name: `text-loader:${extension}`,
  transform(code: string, id: string) {
    if (id.endsWith(extension)) {
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    }
  },
}));

export const vitestCommonConfig = defineConfig({
  test: {
    passWithNoTests: true,
    clearMocks: true,
    setupFiles: [resolve(__dirname, './vitest-setup.ts')],
    // Disable globals due to https://github.com/testing-library/user-event/pull/1176 not being released yet
    globals: false,
    testTimeout: 10000,
    environment: 'node',
    // Projects with `*.test-d.ts` files set `enabled`; the checker matches `yarn task check`.
    typecheck: {
      checker: join(dirname(require.resolve('typescript-native/package.json')), 'bin', 'tsc'),
      // Diagnostics outside the type test files are `yarn task check`'s job.
      ignoreSourceErrors: true,
    },
  },
});
