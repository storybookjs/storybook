/// <reference types="webpack-env" />

import type { Meta, StoryContext, StoryObj } from '@storybook/svelte';

import Story from './components/Story.svelte';

export { setTemplate } from './components/context.svelte.js';

// FIXME: We don't use webpack anymore(?)
if (module?.hot?.decline) {
  module.hot.decline();
}

export type Template<M extends Meta> = {
  args: StoryObj<M>['args'];
  context: StoryContext<M['args']>;
};

export function defineComponent<const M extends Meta>(meta: M) {
  return {
    Story: Story as typeof Story<M>,
  };
}
