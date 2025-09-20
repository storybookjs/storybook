import type { Decorator } from '@storybook/svelte';
import ContextProvider from '@storybook/sveltekit/internal/MockProvider.svelte';

import type { SvelteKitParameters } from './types';

const svelteKitMocksDecorator: Decorator = (Story, ctx) => {
  const svelteKitParameters: SvelteKitParameters = ctx.parameters?.sveltekit_experimental ?? {};

  const story = Story();

  return {
    Component: ContextProvider,
    props: {
      Story: story,
      svelteKitParameters,
    },
  };
};

export const decorators: Decorator[] = [svelteKitMocksDecorator];
