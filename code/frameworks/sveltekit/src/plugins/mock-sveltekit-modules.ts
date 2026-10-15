import type { Plugin } from 'vite';

export function mockSveltekitModules() {
  return {
    name: 'storybook:sveltekit-mock-modules',
    config: () => ({
      resolve: {
        alias: {
          '$app/forms': '@storybook/sveltekit/internal/mocks/app/forms',
          '$app/navigation': '@storybook/sveltekit/internal/mocks/app/navigation',
          '$app/state': '@storybook/sveltekit/internal/mocks/app/state.svelte.js',
        },
      },
    }),
  } satisfies Plugin;
}
