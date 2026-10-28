import { declareHooks, type HookContext, type Reduce } from '@storybook/core';

import type { CompileOptions } from '../compiler/index.ts';

declare module '@storybook/core' {
  interface StorybookHooks {
    'legacy:mdxLoaderOptions:extend': Reduce<
      (value: CompileOptions, ctx?: HookContext) => CompileOptions
    >;
    'legacy:options:extend': Reduce<
      (value: Record<string, unknown>, ctx?: HookContext) => Record<string, unknown>
    >;
  }
}

/** Declared so calls resolve to the seed when no renderer or legacy preset extends them. */
declareHooks({
  'legacy:mdxLoaderOptions:extend': 'reduce',
  'legacy:options:extend': 'reduce',
});
