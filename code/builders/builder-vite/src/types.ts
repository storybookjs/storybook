import type { Builder, ModuleExports, Options, PresetValue } from 'storybook/internal/types';

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
   * Modules that import the project's files in the preview: every file of the story index (CSF and
   * MDX) and the project's preview file, not other preview annotations. Each module exports an
   * {@link ImportModule}.
   *
   * Like `previewAnnotations`, the entries add up across presets: a framework, its addons and the
   * main config each add theirs. A plain array in the main config appends to the framework's; a
   * function that ignores its argument replaces them. A module listed twice is used once.
   *
   * The importers form a chain, like middleware. Storybook asks the last entry, usually the
   * project's. Its `importFn` asks the entry before it, and so on, down to the import of Vite.
   *
   * An entry is an absolute path (or a `file:` URL), or a package specifier. Vite resolves a
   * package specifier from the project root, so a framework passes its own file as an absolute
   * path, e.g. `fileURLToPath(import.meta.resolve('./importer.js'))`.
   *
   * Addon Vitest shares the project annotations, so there the importers are asked for the preview
   * file too; the test file imports story files itself.
   *
   * @example
   *
   * ```ts
   * // a framework's preset
   * export const experimental_moduleImporters = (entries = []) => [
   *   ...entries,
   *   fileURLToPath(import.meta.resolve('./importer.js')),
   * ];
   *
   * // .storybook/main.ts
   * experimental_moduleImporters: [fileURLToPath(import.meta.resolve('./importer.ts'))],
   *
   * // .storybook/importer.ts
   * import type { ImportFn, ImportModule } from '@storybook/builder-vite';
   *
   * const runtimeFiles = new Map<string, ReturnType<ImportFn>>();
   *
   * export const importModule: ImportModule = (importPath, importFn) => {
   *   if (!importPath.endsWith('.stories.json')) {
   *     return importFn(importPath);
   *   }
   *   if (!runtimeFiles.has(importPath)) {
   *     const url = new URL(importPath, document.baseURI);
   *     runtimeFiles.set(importPath, fetch(url).then((response) => response.json()));
   *   }
   *   return runtimeFiles.get(importPath)!;
   * };
   * ```
   */
  experimental_moduleImporters?: PresetValue<string[]>;
};

/** Imports a file of the story index or the project's preview file, by its `importPath`. */
export type ImportFn = (importPath: string) => Promise<ModuleExports>;

/**
 * The export of a module in `experimental_moduleImporters`. It returns the module the preview uses
 * for `importPath`, or throws. `importPath` is the path as in the story index; for the preview file
 * the same form, e.g. `./.storybook/preview.ts`.
 *
 * - `importFn` imports the file through the importers before this one, and then as Vite would. For
 *   the preview file, which the generated code imports statically, it returns that already
 *   evaluated module. An importer need not call it: a Storybook built once can render story files
 *   that exist only at runtime, which the importer fetches itself.
 * - Return the same object for the same module. The store caches by it, so a new object on every
 *   call processes the file again and remounts its story. A docs file (MDX) refers to a story file
 *   with the module it imports itself, so for a story file that MDX refers to, return what
 *   `importFn` returns.
 * - With CSF Next, a story file imports the preview itself and its stories use that preview. An
 *   importer that replaces the preview file also returns story files whose meta uses it.
 * - It is asked again after an HMR update.
 */
export type ImportModule = (importPath: string, importFn: ImportFn) => Promise<ModuleExports>;

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
