import type { Args as BaseArgs } from '@storybook/types';
import type { Component, ComponentProps, SvelteComponent } from 'svelte';
import type { EmptyObject } from 'type-fest';

import type { Meta, StoryCmp, StoryContext as BaseStoryContext } from '#types';

import Story from './runtime/Story.svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<
  const TOverrideArgs extends BaseArgs = EmptyObject,
  const TMeta extends Meta = Meta,
  TCmp = TMeta['component'],
>(
  meta: TMeta & {
    args?: TCmp extends Component | SvelteComponent | __sveltets_2_IsomorphicComponent
      ? ComponentProps<TCmp>
      : TMeta['args'];
  }
) {
  return {
    Story: Story as StoryCmp<TOverrideArgs, TMeta>,
    meta: meta as TMeta,
  };
}

export type Args<Component extends StoryCmp<any, any>> =
  Component extends StoryCmp<infer _TOverrideArgs extends BaseArgs, infer TMeta extends Meta>
    ? TMeta['args']
    : never;

export type StoryContext<Component extends StoryCmp<any, any>> =
  Component extends StoryCmp<infer _TOverrideArgs extends BaseArgs, infer TMeta extends Meta>
    ? BaseStoryContext<TMeta['args']>
    : never;
