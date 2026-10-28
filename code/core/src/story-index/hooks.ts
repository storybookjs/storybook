import {
  declareHooks,
  type Collect,
  type HookContext,
  type Notify,
  type Reduce,
} from '../instance/hooks.ts';
import type {
  Indexer,
  IndexEntry,
  Manifests,
  StorybookConfigRaw,
  StoryIndex,
} from '@storybook/core/internal/types';
import type { StoryIndexGenerator } from './StoryIndexGenerator.ts';

/** Story index hooks; `StorybookHooks` extends this, as bundled declarations drop relative augmentations. */
export interface IndexHooks {
  'index:indexers:collect': Collect<(value: Indexer[], ctx?: HookContext) => Indexer[]>;
  'index:story-sorts:collect': Collect<
    (
      value: NonNullable<StorybookConfigRaw['storySorts']>,
      ctx?: HookContext
    ) => NonNullable<StorybookConfigRaw['storySorts']>
  >;
  'index:csf:extend': Reduce<(value: Indexer | undefined, ctx?: HookContext) => Indexer>;
  'index:generator:extend': Reduce<
    (value: StoryIndexGenerator | undefined, ctx?: HookContext) => StoryIndexGenerator
  >;
  'index:manifests:extend': Reduce<
    (
      value: Manifests | undefined,
      ctx?: HookContext & { manifestEntries?: IndexEntry[] }
    ) => Manifests
  >;
  'index:component-manifest-generator:extend': Reduce<
    (
      value: ((...args: unknown[]) => unknown) | undefined,
      ctx?: HookContext
    ) => ((...args: unknown[]) => unknown) | undefined
  >;
  'index:invalidated:after': Notify<(index: StoryIndex) => void>;
}

declareHooks({
  'index:indexers:collect': 'collect',
  'index:story-sorts:collect': 'collect',
  'index:csf:extend': 'reduce',
  'index:generator:extend': 'reduce',
  'index:manifests:extend': 'reduce',
  'index:component-manifest-generator:extend': 'reduce',
  'index:invalidated:after': 'notify',
});
