import type {
  Options,
  StorybookConfig as StorybookConfigBase,
} from '@storybook/core/internal/types';

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
  devtool?: false | string | { type: 'all' | 'javascript' | 'css'; use: any }[];
}

/** Main config with `webpack` and `webpackFinal` typed against a Webpack configuration shape. */
export type WebpackStorybookConfig<TWebpackConfiguration = WebpackConfiguration> =
  StorybookConfigBase & {
    /**
     * Modify or return a custom Webpack config after the Storybook's default configuration has run
     * (mostly used by addons).
     */
    webpack?: (
      config: TWebpackConfiguration,
      options: Options
    ) => TWebpackConfiguration | Promise<TWebpackConfiguration>;

    /** Modify or return a custom Webpack config after every addon has run. */
    webpackFinal?: (
      config: TWebpackConfiguration,
      options: Options
    ) => TWebpackConfiguration | Promise<TWebpackConfiguration>;
  };
