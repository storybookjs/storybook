import type { Meta, StoryContext as _SB_StoryContext, StoryObj } from '@storybook/svelte';

import Story from './components/Story.svelte';

export type { Story };
export { setTemplate } from './components/context.svelte.js';

export type Args<S extends Story> = S extends typeof Story<infer M extends Meta>
  ? StoryObj<M>['args']
  : never;
export type StoryContext<S extends Story> = S extends typeof Story<infer M extends Meta>
  ? _SB_StoryContext<StoryObj<M>['args']>
  : never;

export function defineMeta<const M extends Meta>(meta: M) {
  return {
    Story: Story as typeof Story<M>,
    meta,
  };
}
