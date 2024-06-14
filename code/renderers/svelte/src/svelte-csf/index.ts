import type { Args as BaseArgs, StoryContext as BaseStoryContext } from '@storybook/types';
import type { EmptyObject } from 'type-fest';

import type { Meta, SvelteRenderer } from '#types';

import Story from './runtime/Story.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<
  const TOverrideArgs extends BaseArgs = EmptyObject,
  const TMeta extends Meta = Meta,
>(meta: TMeta) {
  return {
    Story: Story as typeof Story<TOverrideArgs, TMeta>,
    meta,
  };
}

export type Args<Component extends ReturnType<typeof defineMeta>['Story']> =
  Component extends typeof Story<infer _TOverrideArgs extends BaseArgs, infer TMeta extends Meta>
    ? TMeta['args']
    : never;

export type StoryContext<Component extends ReturnType<typeof defineMeta>['Story']> =
  Component extends typeof Story<infer _TOverrideArgs extends BaseArgs, infer TMeta extends Meta>
    ? BaseStoryContext<SvelteRenderer, TMeta['args']>
    : never;
