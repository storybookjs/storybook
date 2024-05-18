/// <reference types="webpack-env" />

import type { StoryContext } from '@storybook/svelte';
import type { ComponentProps, SvelteComponent } from 'svelte';

import Story from './components/Story.svelte';

import { setTemplate } from './components/context.svelte.js';

// FIXME: We don't use webpack anymore(?)
if (module?.hot?.decline) {
  module.hot.decline();
}

export type Template<
  Component extends SvelteComponent,
  Props = NonNullable<Partial<ComponentProps<Component>>>,
> = {
  args: Props;
  context: StoryContext<Props>;
};

export { Story, setTemplate };
