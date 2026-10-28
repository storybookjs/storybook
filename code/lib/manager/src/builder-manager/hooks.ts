import { declareHooks, type Collect, type HookContext, type Reduce } from '@storybook/core';
import type { StorybookConfigRaw } from '@storybook/core/internal/types';

declare module '@storybook/core' {
  interface StorybookHooks {
    'manager:favicon:extend': Reduce<(value: string | undefined, ctx?: HookContext) => string>;
    'manager:title:extend': Reduce<
      (value: string | false | undefined, ctx?: HookContext) => string | false
    >;
    'manager:entries:collect': Collect<(value: string[], ctx?: HookContext) => string[]>;
    'manager:head:extend': Reduce<(value: string | undefined, ctx?: HookContext) => string>;
    'manager:refs:extend': Reduce<
      (value: StorybookConfigRaw['refs'], ctx?: HookContext) => StorybookConfigRaw['refs']
    >;
  }
}

declareHooks({
  'manager:favicon:extend': 'reduce',
  'manager:title:extend': 'reduce',
  'manager:entries:collect': 'collect',
  'manager:head:extend': 'reduce',
  'manager:refs:extend': 'reduce',
});
