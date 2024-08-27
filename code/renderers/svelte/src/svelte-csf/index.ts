import type { Args as BaseArgs } from 'storybook/internal/types';
import type { EmptyObject } from 'type-fest';

import type {
  Meta as MetaType,
  StoryCmp,
  StoryContext as BaseStoryContext,
  StoryAnnotations,
  Cmp,
} from '#types';

import StoryComponent from './runtime/Story.svelte';
// TODO: Remove in next major release
import LegacyMetaComponent from './runtime/LegacyMeta.svelte';
// TODO: Remove in next major release
import LegacyStoryComponent from './runtime/LegacyStory.svelte';
// TODO: Remove in next major release
import LegacyTemplateComponent from './runtime/LegacyTemplate.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<
  const TOverrideArgs extends BaseArgs = EmptyObject,
  const TCmp extends Cmp = Cmp,
>(meta: MetaType<TCmp>) {
  return {
    Story: StoryComponent as StoryCmp<EmptyObject, TCmp, typeof meta>,
    meta,
  };
}

export type Args<TStoryCmp> =
  TStoryCmp extends StoryCmp<infer _TOverrideArgs, infer TCmpOrArgs, infer TMeta>
  ? NonNullable<StoryAnnotations<TCmpOrArgs, TMeta>['args']>
  : never;

export type StoryContext<TStoryCmp> =
  TStoryCmp extends StoryCmp<infer _TOverrideArgs, infer TCmpOrArgs, infer TMeta>
  ? BaseStoryContext<TCmpOrArgs, TMeta>
  : never;

// TODO: Remove in next major release
export {
  /**
   * @deprecated Use `defineMeta` instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#meta-component-removed-in-favor-of-definemeta}
   */
  LegacyMetaComponent as Meta,
  /**
   * @deprecated Use `Story` component returned from `defineMeta` instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#export-meta-removed-in-favor-of-definemeta}
   */
  LegacyStoryComponent as Story,
  /**
   * @deprecated Use snippets instead
   * @see {@link https://github.com/storybookjs/addon-svelte-csf/blob/main/MIGRATION.md#template-component-removed}
   */
  LegacyTemplateComponent as Template,
};
