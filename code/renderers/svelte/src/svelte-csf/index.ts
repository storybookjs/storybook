/// <reference types="webpack-env" />

import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';

import Story from './components/Story.svelte';

export { setTemplate } from './components/context.svelte.js';

// FIXME: We don't use webpack anymore(?)
if (module?.hot?.decline) {
  module.hot.decline();
}

// TODO: Consult if these are correct types
export type TArgs<M extends Meta> = StoryObj<M>['args'];
export type TContext<M extends Meta> = StoryContext<M['args']>;

export function defineMeta<const M extends Meta>(meta: M) {
  return {
    Story: Story as typeof Story<M>,
    meta,
  };
}
