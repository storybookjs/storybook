import type { Meta, StoryContext as BaseStoryContext } from '@storybook/svelte';
import type { ComponentType } from 'svelte';

import Story from './runtime/Story.svelte';
import type { StoryObj } from '#types';

export { setTemplate } from './runtime/contexts/template.svelte';

export function defineMeta<TOverrideArgs = unknown, const TMeta extends Meta = Meta>(meta: TMeta) {
  return {
    Story: Story as typeof Story<TMeta, TOverrideArgs>,
    meta,
  };
}

export type Args<TStory extends ComponentType> = TStory extends typeof Story<
  infer TMeta extends Meta
>
  ? StoryObj<TMeta>
  : never;

export type StoryContext<TStory extends ComponentType> = TStory extends typeof Story<
  infer TMeta extends Meta
>
  ? BaseStoryContext<StoryObj<TMeta>>
  : never;
