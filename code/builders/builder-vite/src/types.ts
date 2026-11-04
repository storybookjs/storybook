import type { Builder, Options, PresetValue } from 'storybook/internal/types';

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
   * function that ignores its argument replaces them. A framework types its preset export as
   * `PresetValue<string[]>`.
   *
   * The importers form a chain, like middleware. Storybook asks the last entry, usually the
   * project's. Its `importFn` asks the entry before it, and so on, down to the import of Vite. A
   * module listed twice is used once, at its last place, so the main config can move a framework's
   * importer by listing it again.
   *
   * An entry is an absolute path (or a `file:` URL), or a package specifier. Vite resolves a
   * package specifier from the project root, so a framework passes its own file as an absolute
   * path, e.g. `fileURLToPath(import.meta.resolve('./importer.js'))`.
   *
   * In Addon Vitest the importers are asked for the preview file only: the test file imports story
   * files itself.
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
   * import type { ImportModule, ModuleImportFn } from 'storybook/internal/types';
   *
   * const runtimeFiles = new Map<string, ReturnType<ModuleImportFn>>();
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

export type { ImportModule, ModuleImportFn as ImportFn } from 'storybook/internal/types';

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
