import type { Args as BaseArgs } from '@storybook/types';
import type { EmptyObject } from 'type-fest';

import type { Meta, StoryCmp, StoryContext as BaseStoryContext } from '#types';

import Story from './runtime/Story.svelte';
import type { Component, SvelteComponent } from 'svelte';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<const TMeta extends Meta = Meta>(meta: TMeta) {
  return {
    Story: Story as StoryCmp<EmptyObject, TMeta>,
    meta: meta as TMeta extends { component?: infer TCmp }
      ? TCmp extends Component | SvelteComponent | __sveltets_2_IsomorphicComponent
        ? Meta<TCmp>
        : never
      : TMeta extends { args?: infer TArgs }
        ? TArgs extends BaseArgs
          ? Meta<Component<TArgs>>
          : never
        : never,
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
