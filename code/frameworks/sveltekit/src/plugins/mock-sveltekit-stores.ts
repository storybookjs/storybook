import type { Plugin } from 'vite';

export function mockSveltekitStores() {
  return {
    name: 'storybook:sveltekit-mock-stores',
    config: () => ({
      resolve: {
        alias: {
          '$app/forms': '@storybook/sveltekit/internal/mocks/app/forms',
          '$app/navigation': '@storybook/sveltekit/internal/mocks/app/navigation',
          '$app/stores': '@storybook/sveltekit/internal/mocks/app/stores',
        },
      },
    }),
  } satisfies Plugin;
}
