import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import type { Alias, Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

import type { BuildEntries } from '../scripts/build/utils/entry-utils.ts';
import coreConfig from './core/build-config.ts';
import managerConfig from './lib/manager/build-config.ts';
import openServiceConfig from './lib/open-service/build-config.ts';
import uiConfig from './lib/ui/build-config.ts';

const require = createRequire(import.meta.url);

const SPLIT_PACKAGES: Array<[name: string, dir: string, config: BuildEntries]> = [
  ['@storybook/core', 'core', coreConfig],
  ['@storybook/ui', 'lib/ui', uiConfig],
  ['@storybook/manager', 'lib/manager', managerConfig],
];
// Resolved to source like the packages above, but `storybook` re-exports none of their keys.
const SOURCE_ONLY_PACKAGES: typeof SPLIT_PACKAGES = [
  ['@storybook/open-service', 'lib/open-service', openServiceConfig],
];

/**
 * Resolves the packages behind `storybook` to source in the tests of the packages above them, as
 * relative imports did before the split, so mocks of their modules apply. An alias, unlike a
 * resolve condition, does not reach Node's own loader (Vitest forwards SSR conditions to it).
 */
export const splitPackagesSourceAliases: Alias[] = [
  ...SPLIT_PACKAGES,
  ...SOURCE_ONLY_PACKAGES,
].flatMap(([name, dir, config]) =>
  Object.values(config.entries).flatMap((entries) =>
    entries.flatMap(({ exportEntries = [], entryPoint }) =>
      exportEntries.map((key) => ({
        find: new RegExp(`^${`${name}${key.slice(1)}`.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`),
        replacement: join(import.meta.dirname, dir, entryPoint),
      }))
    )
  )
);

/**
 * `storybook/*` keys that `storybook` only re-exports, resolved straight to the owning package in
 * tests, so a mock of `storybook/internal/node-logger` is also the module core's own code imports,
 * as before the split. Keys whose product file adds behavior (annotation composition, the review toolset, the
 * `experimental_loadStorybook` wrapper) or that the product owns keep resolving to `storybook`.
 */
const PRODUCT_BEHAVIOR_KEYS = new Set([
  './preview-api',
  './internal/preview-api',
  './internal/story-index',
  './internal/csf',
  './internal/instance',
  './internal/preview-page',
  './internal/services',
]);
const storybookReExportAliases: Alias[] = SPLIT_PACKAGES.flatMap(([name, , config]) =>
  Object.values(config.entries).flatMap((entries) =>
    entries.flatMap(({ exportEntries = [], dts }) =>
      exportEntries
        .filter(
          (key) =>
            key !== '.' && !key.startsWith('./internal/deep/') && !PRODUCT_BEHAVIOR_KEYS.has(key)
        )
        .filter(() => dts === undefined)
        .map((key) => ({
          find: new RegExp(
            `^${`storybook${key.slice(1)}`.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`
          ),
          replacement: `${name}${key.slice(1)}`,
        }))
    )
  )
);

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
    alias: [
      { find: /^oxc-parser$/, replacement: require.resolve('oxc-parser') },
      ...storybookReExportAliases,
    ],
  },
  test: {
    passWithNoTests: true,
    clearMocks: true,
    setupFiles: [resolve(__dirname, './vitest-setup.ts')],
    // Disable globals due to https://github.com/testing-library/user-event/pull/1176 not being released yet
    globals: false,
    testTimeout: 10000,
    environment: 'node',
    server: {
      deps: {
        // Built presets and native addon entries, which `importModule` loads by path, run in Node's
        // loader as in a real host: Vitest's module runner can hand a concurrent importer the
        // unfinished exports of a module still evaluating. Other built files stay inlined, since
        // tests mock and spy on them and some only load through Vite.
        external: [/\/code\/[^/]+\/[^/]+\/dist\/(?:node\/|node\.js$|preset\.js$)/],
      },
    },
    // `enabled` is set per project with `*.test-d.ts` files: Vitest warns once per enabling project.
    typecheck: {
      checker: join(dirname(require.resolve('typescript-native/package.json')), 'bin', 'tsc'),
      // Diagnostics outside the type test files are `yarn task check`'s job.
      ignoreSourceErrors: true,
    },
  },
});
