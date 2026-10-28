import { declareHooks, type Collect, type HookContext, type Reduce } from '@storybook/core';
import type { InlineConfig } from 'vite';

declare module '@storybook/core' {
  interface StorybookHooks {
    'builder:vite:extend': Reduce<(config: InlineConfig, ctx?: HookContext) => InlineConfig>;
    'builder:vite-deps:collect': Collect<(value: string[], ctx?: HookContext) => string[]>;
  }
}

declareHooks({
  'builder:vite:extend': 'reduce',
  'builder:vite-deps:collect': 'collect',
});
