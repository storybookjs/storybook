import type {
  BuilderResult as BuilderResultBase,
  Options,
  TypescriptOptions as WebpackTypescriptOptions,
} from '@storybook/core/internal/types';

import type ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import type { Configuration, Stats } from 'webpack';

import type { WebpackStorybookConfig as StorybookConfig } from './webpack-types.ts';

type TypeScriptOptionsBase = Partial<WebpackTypescriptOptions>;

/** Options for TypeScript usage within Storybook. */
export interface TypescriptOptions extends TypeScriptOptionsBase {
  /** Configures `fork-ts-checker-webpack-plugin` */
  checkOptions?: ConstructorParameters<typeof ForkTsCheckerWebpackPlugin>[0];
}

export interface StorybookConfigWebpack extends Omit<
  StorybookConfig,
  'webpack' | 'webpackFinal' | 'features'
> {
  /**
   * Modify or return a custom Webpack config after the Storybook's default configuration has run
   * (mostly used by addons).
   */
  webpack?: (config: Configuration, options: Options) => Configuration | Promise<Configuration>;

  /** Modify or return a custom Webpack config after every addon has run. */
  webpackFinal?: (
    config: Configuration,
    options: Options
  ) => Configuration | Promise<Configuration>;

  features?: StorybookConfig['features'] & {
    /**
     * Enable the experimental `.test` function in CSF Next
     *
     * @see https://storybook.js.org/docs/api/main-config/main-config-features#experimentaltestsyntax
     */
    experimentalTestSyntax?: boolean;

    /**
     * Remove the `bugfixes` option from `@babel/preset-env`. This is required when using Babel 8 and when
     * Storybook fails to detect your Babel version.
     * @default false
     */
    babelRemoveBugfixes?: boolean;
  };
}

export type BuilderOptions = {
  fsCache?: boolean;
  lazyCompilation?: boolean;
};

export interface BuilderResult extends BuilderResultBase {
  stats?: Stats;
}
