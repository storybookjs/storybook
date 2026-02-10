import type { Builder, Options } from 'storybook/internal/types';

import type { RollupWatcher } from 'rollup';
import type { InlineConfig, UserConfig } from 'vite';

// Storybook's Stats are optional Webpack related property
export type ViteStats = {
  toJson: () => any;
  watcher?: RollupWatcher;
};

export type ViteBuilder = Builder<UserConfig, ViteStats>;

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
};
