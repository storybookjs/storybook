import type { Args as BaseArgs } from '@storybook/types';
import type { EmptyObject } from 'type-fest';

import type {
  Meta,
  StoryCmp,
  StoryContext as BaseStoryContext,
  StoryAnnotations,
  Cmp,
} from '#types';

import Story from './runtime/Story.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<
  const TOverrideArgs extends BaseArgs = EmptyObject,
  const TCmp extends Cmp = Cmp,
>(meta: Meta<TCmp>) {
  return {
    Story: Story as StoryCmp<EmptyObject, TCmp, typeof meta>,
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
