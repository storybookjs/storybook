import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { type Plugin, defaultClientConditions, defaultServerConditions } from 'vite';
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
  resolve: {
    // Projects that resolve the `browser` condition, such as Svelte's, would get the WASM build of
    // oxc-parser, which is not installed. Storybook parses in Node, with the native binding.
    alias: [{ find: /^oxc-parser$/, replacement: require.resolve('oxc-parser') }],
    // Resolve workspace packages to their source, as TypeScript's `customConditions` does, so tests
    // need no build and `vitest related` follows imports across packages.
    conditions: ['code', ...defaultClientConditions],
  },
  ssr: { resolve: { conditions: ['code', ...defaultServerConditions] } },
  test: {
    passWithNoTests: true,
    clearMocks: true,
    server: {
      deps: {
        // storybook/test registers its own copy of `@vitest/expect` on `chai`. Vitest loads the same
        // `chai` from node_modules, so without inlining, each would wrap the other's assertions
        // (e.g. `rejects.toThrow` would wrap the rejected value twice). The published storybook/test
        // bundles its own `chai`; inlining gives the tests the same isolation.
        inline: ['chai', '@vitest/expect'],
      },
    },
    setupFiles: [resolve(__dirname, './vitest-setup.ts')],
    // Disable globals due to https://github.com/testing-library/user-event/pull/1176 not being released yet
    globals: false,
    testTimeout: 10000,
    environment: 'node',
    // `enabled` is set per project with `*.test-d.ts` files: Vitest warns once per enabling project.
    typecheck: {
      checker: join(dirname(require.resolve('typescript-native/package.json')), 'bin', 'tsc'),
      // Diagnostics outside the type test files are `yarn task check`'s job.
      ignoreSourceErrors: true,
      // Each project that enables type tests has one; locally the `code` condition needs no build.
      tsconfig: process.env.CI ? 'tsconfig.typecheck.json' : undefined,
    },
  },
});
