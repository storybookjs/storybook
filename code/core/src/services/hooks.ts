import {
  declareHooks,
  type Collect,
  type HookContext,
  type Notify,
  type Reduce,
} from '../instance/hooks.ts';
import type { DocgenProviderDescriptor, StoryDocsProvider } from '@storybook/core/internal/types';
import type { ImportParser } from '../shared/open-service/services/module-graph/engine/parser-registry/types.ts';
import type { StoryRenderAccess } from '../shared/open-service/toolsets/stories/screenshot-stories.ts';

/** Service hooks; `StorybookHooks` extends this, as bundled declarations drop relative augmentations. */
export interface ServiceHooks {
  'core:services:register': Notify<(value: void, ctx?: HookContext) => void>;
  'core:docgen-providers:collect': Collect<
    (value: DocgenProviderDescriptor[], ctx?: HookContext) => DocgenProviderDescriptor[]
  >;
  'core:story-docs-provider:extend': Reduce<
    (value: StoryDocsProvider | undefined, ctx?: HookContext) => StoryDocsProvider
  >;
  'core:import-parsers:collect': Collect<
    (value: ImportParser[], ctx?: HookContext) => ImportParser[]
  >;
  'core:docgen-enabled:extend': Reduce<(value: boolean, ctx?: HookContext) => boolean>;
  'core:story-render:extend': Reduce<
    (value: StoryRenderAccess | undefined, ctx?: HookContext) => StoryRenderAccess | undefined
  >;
  /** The dev server's preview builder started and handed the module graph its adapter. */
  'core:preview-builder:ready': Notify<(value: void, ctx?: HookContext) => void>;
}

declareHooks({
  'core:services:register': 'notify',
  'core:docgen-providers:collect': 'collect',
  'core:story-docs-provider:extend': 'reduce',
  'core:import-parsers:collect': 'collect',
  'core:docgen-enabled:extend': 'reduce',
  'core:story-render:extend': 'reduce',
  'core:preview-builder:ready': 'notify',
});
