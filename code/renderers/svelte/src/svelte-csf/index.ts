import type { Args as BaseArgs } from '@storybook/types';
import type { ComponentProps } from 'svelte';
import type { EmptyObject } from 'type-fest';

import type {
  Meta,
  StoryCmp,
  StoryContext as BaseStoryContext,
  PossibleCmpType,
  MapSnippetsToAcceptPrimitives,
  StoryAnnotations,
} from '#types';

import Story from './runtime/Story.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<
  const TOverrideArgs extends BaseArgs = EmptyObject,
  const TMeta extends Meta = Meta,
  TCmp = TMeta['component'],
>(
  meta: TMeta & {
    args?: MapSnippetsToAcceptPrimitives<
      TCmp extends PossibleCmpType
        ? ComponentProps<TCmp>
        : TMeta['args'] extends BaseArgs
          ? TMeta['args']
          : never
    >;
  }
) {
  return {
    // @ts-expect-error FIXME: Can anything be done here?
    Story: Story as StoryCmp<TOverrideArgs, TMeta>,
    meta,
  };
}

export type Args<TStoryCmp> =
  TStoryCmp extends StoryCmp<infer _TOverrideArgs extends BaseArgs, infer TMeta extends Meta>
    ? NonNullable<StoryAnnotations<TMeta>['args']>
    : never;

export type StoryContext<TStoryCmp> =
  TStoryCmp extends StoryCmp<infer _TOverrideArgs extends BaseArgs, infer TMeta extends Meta>
    ? BaseStoryContext<TMeta['args']>
    : never;
