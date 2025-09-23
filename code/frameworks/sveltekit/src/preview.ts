import type { Decorator } from '@storybook/svelte';
import MockProvider from '@storybook/sveltekit/internal/MockProvider.svelte';
import {
  setAppStateNavigating,
  setAppStatePage,
  setAppStateUpdated,
} from '@storybook/sveltekit/internal/mocks/app/state.svelte.js';

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

export const beforeEach: Preview['beforeEach'] = async (ctx) => {
  const svelteKitParameters: SvelteKitParameters = ctx.parameters?.sveltekit_experimental ?? {};

  setAppStatePage(svelteKitParameters?.state?.page);
  setAppStateNavigating(svelteKitParameters?.state?.navigating);
  setAppStateUpdated(svelteKitParameters?.state?.updated);
};
