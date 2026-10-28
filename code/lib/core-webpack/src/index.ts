/**
 * Deprecated: the Webpack helpers and types moved to `@storybook/builder-webpack5`. This package
 * re-exports them until Storybook 12.
 */
export {
  importPipeline,
  loadCustomWebpackConfig,
  toImportFn,
  toImportFnPart,
  webpackIncludeRegexp,
} from '@storybook/builder-webpack5';
export type {
  BuilderOptions,
  ModuleConfig,
  ResolveConfig,
  RulesConfig,
  WebpackConfiguration,
  WebpackStorybookConfig as StorybookConfig,
} from '@storybook/builder-webpack5';
export type { Options, Preset, BuilderResult, TypescriptOptions } from 'storybook/internal/types';
export * from './check-webpack-version.ts';
export * from './merge-webpack-config.ts';
export * from './to-require-context.ts';
