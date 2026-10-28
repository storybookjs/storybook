import { declareHooks, type HookContext, type Reduce } from '@storybook/core';
import type { Configuration } from 'webpack';
import type webpack from 'webpack';

declare module '@storybook/core' {
  interface StorybookHooks {
    'builder:webpack:extend': Reduce<(config: Configuration, ctx?: HookContext) => Configuration>;
    'builder:webpack-config:extend': Reduce<
      (config: Configuration, ctx?: HookContext) => Configuration
    >;
    'builder:webpack-instance:extend': Reduce<
      (
        value: typeof webpack | { default: typeof webpack },
        ctx?: HookContext
      ) => typeof webpack | { default: typeof webpack }
    >;
    'builder:babel:extend': Reduce<
      (config: Record<string, unknown> | undefined, ctx?: HookContext) => Record<string, unknown>
    >;
    'builder:babel-default:extend': Reduce<
      (config: Record<string, unknown> | undefined, ctx?: HookContext) => Record<string, unknown>
    >;
    'builder:swc:extend': Reduce<
      (config: Record<string, unknown> | undefined, ctx?: HookContext) => Record<string, unknown>
    >;
  }
}

declareHooks({
  'builder:webpack:extend': 'reduce',
  'builder:webpack-config:extend': 'reduce',
  'builder:webpack-instance:extend': 'reduce',
  'builder:babel:extend': 'reduce',
  'builder:babel-default:extend': 'reduce',
  'builder:swc:extend': 'reduce',
});
