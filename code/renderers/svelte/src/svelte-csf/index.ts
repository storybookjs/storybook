/// <reference types="webpack-env" />

import type { Meta, StoryContext as _SB_StoryContext, StoryObj } from '@storybook/svelte';

import Story from './components/Story.svelte';

export type { Story };
export { setTemplate } from './components/context.svelte.js';

// FIXME: We don't use webpack anymore(?)
if (module?.hot?.decline) {
  module.hot.decline();
}

// TODO: Consult if these are correct types
export type Args<S extends Story> = S extends typeof Story<infer M extends Meta>
  ? StoryObj<M>['args']
  : never;
export type StoryContext<S extends Story> = S extends typeof Story<infer M extends Meta>
  ? _SB_StoryContext<M['args']>
  : never;

export function defineMeta<const M extends Meta>(meta: M) {
  return {
    Story: Story as typeof Story<M>,
    meta,
  };
}
