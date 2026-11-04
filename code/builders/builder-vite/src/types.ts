import type { Builder, Options } from 'storybook/internal/types';

import type { InlineConfig, UserConfig } from 'vite';

// Storybook's Stats are optional Webpack related property
type ViteStats = {
  toJson: () => any;
};

export type ViteBuilder = Builder<UserConfig, ViteStats>;

export type ViteFinal = (
  config: InlineConfig,
  options: Options
) => InlineConfig | Promise<InlineConfig>;

export type StorybookConfigVite = {
  viteFinal?: ViteFinal;
  /**
   * A module that loads the project's files in the preview: every file of the story index (CSF and
   * MDX) and the project's preview file, not other preview annotations. A framework sets it in its
   * preset, a project in its main config.
   *
   * The value is an absolute path (or a `file:` URL), or a package specifier. Vite resolves a
   * package specifier from the project root, so a framework passes its own file as an absolute
   * path, e.g. `fileURLToPath(import.meta.resolve('./loader.js'))`.
   *
   * The module exports `load(importPath, importFn)`, where `importPath` is the path as in the
   * story index (for the preview file the same form, e.g. `./.storybook/preview.ts`) and
   * `importFn(importPath)` imports the file as Vite would. For the preview file, which the
   * generated code imports statically, `importFn` returns that already evaluated module. `load`
   * returns the module to use, or throws. It is asked again after an HMR update.
   *
   * `load` need not call `importFn`, which knows only the files of the build. A Storybook built once
   * can render story files that exist only at runtime, listed by an `index.json` served next to it:
   * `load` fetches them itself.
   *
   * Return the same object for the same module. The store caches by it, so a new object on every
   * call processes the file again and remounts its story. A docs file (MDX) refers to a story file
   * with the module it imports itself, so for a story file that MDX refers to, return what
   * `importFn` returns.
   *
   * With CSF Next, a story file imports the preview itself and its stories use that preview. A
   * `load` that replaces the preview file also returns story files whose meta uses the replaced
   * preview.
   *
   * Addon Vitest shares the project annotations, so there `load` is asked for the preview file
   * too; it imports story files from the test file.
   *
   * @example
   *
   * ```ts
   * // .storybook/main.ts
   * experimental_moduleLoader: fileURLToPath(import.meta.resolve('./loader.ts')),
   *
   * // .storybook/loader.ts
   * const runtimeFiles = new Map<string, Promise<unknown>>();
   *
   * export function load(importPath: string, importFn: (path: string) => Promise<unknown>) {
   *   if (!importPath.endsWith('.stories.json')) {
   *     return importFn(importPath);
   *   }
   *   if (!runtimeFiles.has(importPath)) {
   *     const url = new URL(importPath, document.baseURI);
   *     runtimeFiles.set(importPath, fetch(url).then((response) => response.json()));
   *   }
   *   return runtimeFiles.get(importPath);
   * }
   * ```
   */
  experimental_moduleLoader?: string;
};

export type BuilderOptions = {
  /**
   * Path to `vite.config` file, relative to `process.cwd()`.
   *
   * Set to `null` to not load any Vite config file. Use this to keep a config file that
   * Storybook's auto-discovery does not see unloaded, and to silence the matching warning.
   */
  viteConfigPath?: string | null;
  /**
   * How Vite loads the config file. Equivalent to Vite's `--configLoader` CLI flag and the
   * `configLoader` option of `loadConfigFromFile`.
   *
   * Requires Vite 6.1.0 or higher. On older Vite versions this option is silently ignored.
   */
  configLoader?: 'bundle' | 'runner' | 'native';
};
