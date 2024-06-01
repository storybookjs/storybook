import type { Meta, StoryContext as BaseStoryContext, StoryObj } from '@storybook/svelte';
import type { ComponentType } from 'svelte';

import Story from './runtime/Story.svelte';

export type { Story };
export { setTemplate } from './runtime/contexts/template.svelte.js';

export function defineMeta<const TMeta extends Meta = Meta>(meta: TMeta) {
  return {
    Story: Story as typeof Story<TMeta>,
    meta,
  };
}
export type Args<TStory extends ComponentType> = TStory extends typeof Story<
  infer TMeta extends Meta
>
  ? StoryObj<TMeta>['args']
  : never;

export type StoryContext<TStory extends ComponentType> = TStory extends typeof Story<
  infer TMeta extends Meta
>
  ? BaseStoryContext<StoryObj<TMeta>['args']>
  : never;
