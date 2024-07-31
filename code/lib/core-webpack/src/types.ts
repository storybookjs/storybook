import type { Options, StorybookConfig as StorybookConfigBase } from 'storybook/internal/types';

export type { Options, Preset, BuilderResult, TypescriptOptions } from 'storybook/internal/types';

export type RulesConfig = any;

export type ModuleConfig = {
  rules?: RulesConfig[];
};

export type ResolveConfig = {
  extensions?: string[];
  mainFields?: (string | string[])[] | undefined;
  alias?: any;
};

export interface WebpackConfiguration {
  plugins?: any[];
  module?: ModuleConfig;
  resolve?: ResolveConfig;
  optimization?: any;
  devtool?: false | string;
}

export type BuilderOptions = {
  fsCache?: boolean;
  lazyCompilation?: boolean;
};

export type StorybookConfig<TWebpackConfiguration = WebpackConfiguration> = StorybookConfigBase & {
  /**
   * Modify or return a custom Webpack config after the Storybook's default configuration
   * has run (mostly used by addons).
   */
  webpack?: (
    config: TWebpackConfiguration,
    options: Options
  ) => TWebpackConfiguration | Promise<TWebpackConfiguration>;

  /**
   * Modify or return a custom Webpack config after every addon has run.
   */
  webpackFinal?: (
    config: TWebpackConfiguration,
    options: Options
  ) => TWebpackConfiguration | Promise<TWebpackConfiguration>;
};
