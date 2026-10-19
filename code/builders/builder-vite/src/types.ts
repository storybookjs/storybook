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
   * A module that loads the project's files in the preview, meant for frameworks: every file of the
   * story index (CSF and MDX) and the project's preview file, not other preview annotations. An
   * absolute path or a package specifier.
   *
   * The module exports `load(importPath, importFn)`, where `importPath` is the path as in the
   * story index (for the preview file the same form, e.g. `./.storybook/preview.ts`) and
   * `importFn(importPath)` imports the file as Vite would. For the preview file, which the
   * generated code imports statically, `importFn` returns that already evaluated module. `load`
   * returns the module to use, or throws. It is asked again after an HMR update. Return the same
   * object for the same module: the store caches by it, and an MDX file that imports a story file
   * must see the object `load` returns for that file.
   *
   * Addon Vitest shares the project annotations, so there `load` is asked for the preview file
   * too; it imports story files from the test file.
   */
  experimental_moduleLoader?: string;
};

export type BuilderOptions = {
  /** Path to `vite.config` file, relative to `process.cwd()`. */
  viteConfigPath?: string;
  /**
   * How Vite loads the config file. Equivalent to Vite's `--configLoader` CLI flag and the
   * `configLoader` option of `loadConfigFromFile`.
   *
   * Requires Vite 6.1.0 or higher. On older Vite versions this option is silently ignored.
   */
  configLoader?: 'bundle' | 'runner' | 'native';
};
