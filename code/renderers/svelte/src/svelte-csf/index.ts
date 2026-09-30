/* eslint-disable @typescript-eslint/no-explicit-any */
import StoryComponent from '@storybook/svelte/internal/svelte-csf/Story.svelte';
// TODO: Remove in next major release
import LegacyMetaComponent from '@storybook/svelte/internal/svelte-csf/LegacyMeta.svelte';
// TODO: Remove in next major release
import LegacyStoryComponent from '@storybook/svelte/internal/svelte-csf/LegacyStory.svelte';
// TODO: Remove in next major release
import LegacyTemplateComponent from '@storybook/svelte/internal/svelte-csf/LegacyTemplate.svelte';

import type { Cmp, ComponentAnnotations, StoryComponent as StoryComponentType } from './types.ts';
export type { StoryContext } from './types.ts';
import type { ComponentProps, Snippet } from 'svelte';

export function defineMeta<TSnippet, TCmp extends Cmp>(
  _meta: {
    render?: TSnippet;
    component?: TCmp;
    args?: Partial<
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
  Story: StoryComponentType<
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
export type Args<TStoryCmp> =
  // The component type is `any`: `Component` props are contravariant, so matching on `Cmp` infers nothing
  TStoryCmp extends StoryComponentType<infer TArgs extends Record<string, any>, any>
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
