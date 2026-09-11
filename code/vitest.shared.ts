import { resolve } from 'node:path';

import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

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
  },
});
