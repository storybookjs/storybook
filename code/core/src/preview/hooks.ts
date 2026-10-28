import { declareHooks, type Collect, type HookContext, type Reduce } from '../instance/hooks.ts';
import type { PreviewAnnotation } from '@storybook/core/internal/types';

/** Preview hooks; `StorybookHooks` extends this, as bundled declarations drop relative augmentations. */
export interface PreviewHooks {
  'preview:log-level:extend': Reduce<(value: string | undefined, ctx?: HookContext) => string>;
  'preview:annotations:collect': Collect<
    (value: PreviewAnnotation[], ctx?: HookContext) => PreviewAnnotation[]
  >;
  'preview:entries:collect': Collect<(value: string[], ctx?: HookContext) => string[]>;
  'preview:head:extend': Reduce<(value: string | undefined, ctx?: HookContext) => string>;
  'preview:body:extend': Reduce<(value: string | undefined, ctx?: HookContext) => string>;
  /** Return `false` to reload the page instead of hot-updating stories. */
  'preview:hmr:extend': Reduce<(value: boolean, ctx?: HookContext) => boolean>;
}

declareHooks({
  'preview:log-level:extend': 'reduce',
  'preview:annotations:collect': 'collect',
  'preview:entries:collect': 'collect',
  'preview:head:extend': 'reduce',
  'preview:body:extend': 'reduce',
  'preview:hmr:extend': 'reduce',
});
