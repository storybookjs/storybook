/* eslint-disable @typescript-eslint/no-explicit-any */
import StoryComponent from './runtime/Story.svelte';
// TODO: Remove in next major release
import LegacyMetaComponent from './runtime/LegacyMeta.svelte';
// TODO: Remove in next major release
import LegacyStoryComponent from './runtime/LegacyStory.svelte';
// TODO: Remove in next major release
import LegacyTemplateComponent from './runtime/LegacyTemplate.svelte';

import type { Cmp, ComponentAnnotations } from './types.js';
export type { StoryContext } from './types.js';
import type { ComponentProps, Snippet } from 'svelte';

export function defineMeta<TSnippet extends Snippet<[any, any]>, TCmp extends Cmp>(
  _meta: {
    render?: TSnippet;
    component?: TCmp;
    args: Partial<
      TSnippet extends Snippet<[infer TArgs extends Record<string, any>, any]>
        ? TArgs
        : ComponentProps<TCmp>
    >;
  } & Omit<
    ComponentAnnotations<
      TCmp,
      TSnippet extends Snippet<[infer TArgs extends Record<string, any>, any]>
        ? TArgs
        : ComponentProps<TCmp>
    >,
    'render' | 'component' | 'args'
  >
): {
  Story: typeof StoryComponent<
    TSnippet extends Snippet<[infer TArgs extends Record<string, any>, any]>
      ? TArgs
      : ComponentProps<TCmp>,
    TCmp
  >;
} {
  return {
    Story: StoryComponent as any,
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
export type Args<TStoryCmp> = TStoryCmp extends typeof StoryComponent<
  infer TArgs extends Record<string, any>,
  Cmp
>
  ? TArgs
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

// TODO: Remove in next major release
export type * from './legacy-types.d.ts';
