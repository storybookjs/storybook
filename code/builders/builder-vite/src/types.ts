import type { InlineConfig, UserConfig } from 'vite';
import type { Builder, Options } from 'storybook/internal/types';

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
};

export type BuilderOptions = {
  /**
   * Path to vite.config file, relative to CWD.
   */
  viteConfigPath?: string;
};
