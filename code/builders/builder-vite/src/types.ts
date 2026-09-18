import type { Builder, Options } from 'storybook/internal/types';

import type { InlineConfig, UserConfig, ViteDevServer } from 'vite';

// Storybook's Stats are optional Webpack related property
type ViteStats = {
  toJson: () => unknown;
};

export type ViteBuilder = Omit<Builder<UserConfig, ViteStats>, 'start'> & {
  start: (args: Parameters<Builder<UserConfig, ViteStats>['start']>[0]) => Promise<{
    stats: ViteStats;
    totalTime: ReturnType<typeof process.hrtime>;
    bail: (e?: Error) => Promise<void>;
    server: ViteDevServer;
  }>;
};

export type ViteFinal = (
  config: InlineConfig,
  options: Options
) => InlineConfig | Promise<InlineConfig>;

export type StorybookConfigVite = {
  viteFinal?: ViteFinal;
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
