import StoryComponent from './runtime/Story.svelte';
// TODO: Remove in next major release
import LegacyMetaComponent from './runtime/LegacyMeta.svelte';
// TODO: Remove in next major release
import LegacyStoryComponent from './runtime/LegacyStory.svelte';
// TODO: Remove in next major release
import LegacyTemplateComponent from './runtime/LegacyTemplate.svelte';

import type {
  Meta as MetaType,
  StoryContext as BaseStoryContext,
  StoryAnnotations,
  Cmp,
} from './types.js';

export function defineMeta<const TCmp extends Cmp>(_meta: MetaType<TCmp>) {
  return {
    Story: StoryComponent as typeof StoryComponent<TCmp>,
  };
}

/**
 * Infer **first** parameter type `args` in template snippet specified at the root of fragment _(a shared one)_.
 * @template TStoryCmp destructured `Story` property from the {@link defineMeta} call.
 *
 * @example
 * ```svelte
 * {#snippet template(args: Args<typeof Story>)}
 *   <!--             👆 first parameter ->
 * {/snippet}
 * ```
 */
export type Args<TStoryCmp> = TStoryCmp extends typeof StoryComponent<infer TCmp extends Cmp>
  ? NonNullable<StoryAnnotations<TCmp>['args']>
  : never;

/**
 * Infer **second** parameter type `storyContext` in template snippet specified at the root of fragment _(a shared one)_.
 * @template TStoryCmp destructured `Story` property from the {@link defineMeta} call.
 *
 * @example
 * ```svelte
 * {#snippet template(args: Args<typeof Story>, context: StoryContext<typeof Story>)}
 *   <!--                                       👆 second parameter ->
 * {/snippet}
 * ```
 */
export type StoryContext<TStoryCmp> = TStoryCmp extends typeof StoryComponent<
  infer TCmp extends Cmp
>
  ? BaseStoryContext<TCmp>
  : never;

/**
 * Fill the generic type parameter for [`createRawSnippet()`](https://svelte.dev/docs/svelte/svelte#createRawSnippet)
 * to get better type-safety experience.
 * @template TStoryCmp destructured `Story` property from the {@link defineMeta} call.
 */
export type TemplateSnippet<TStoryCmp> = [Args<TStoryCmp>, StoryContext<TStoryCmp>];

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

// TODO: Remove in next major release
export type * from './legacy-types.d.ts';
