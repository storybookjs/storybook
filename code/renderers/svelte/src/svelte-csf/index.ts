/* eslint-disable @typescript-eslint/no-explicit-any */
import StoryComponent from '@storybook/svelte/internal/svelte-csf/Story.svelte';

import type { Cmp, ComponentAnnotations, StoryComponent as StoryComponentType } from './types.ts';
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
