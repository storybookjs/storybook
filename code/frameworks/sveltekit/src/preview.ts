import type { Decorator } from '@storybook/svelte';
import MockProvider from '@storybook/sveltekit/internal/MockProvider.svelte';

import type { SvelteKitParameters } from './types';

const svelteKitMocksDecorator: Decorator = (Story, ctx) => {
  const svelteKitParameters: SvelteKitParameters = ctx.parameters?.sveltekit_experimental ?? {};

  return {
    Component: MockProvider,
    props: {
      svelteKitParameters,
    },
  };
};

export const decorators: Decorator[] = [svelteKitMocksDecorator];
