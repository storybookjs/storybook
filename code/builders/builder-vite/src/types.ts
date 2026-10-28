import type { Options } from '@storybook/core/internal/types';

import type { InlineConfig } from 'vite';

export type ViteFinal = (
  config: InlineConfig,
  options: Options
) => InlineConfig | Promise<InlineConfig>;

export type StorybookConfigVite = {
  viteFinal?: ViteFinal;
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
