import type { Plugin } from 'vite';

export function mockSveltekitModules() {
  return {
    name: 'storybook:sveltekit-mock-modules',
    config: () => ({
      resolve: {
        alias: {
          '$app/forms': '@storybook/sveltekit/forms.mock',
          '$app/navigation': '@storybook/sveltekit/navigation.mock',
          '$app/state': '@storybook/sveltekit/internal/mocks/app/state.svelte.js',
        },
      },
    }),
  } satisfies Plugin;
}
