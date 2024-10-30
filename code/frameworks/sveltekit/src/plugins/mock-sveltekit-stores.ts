import { resolve } from 'node:path';

import type { Plugin } from 'vite';

export async function mockSveltekitStores() {
  return {
    name: 'storybook:sveltekit-mock-stores',
    config: () => ({
      resolve: {
        alias: {
          '$app/forms': resolve(__dirname, '../src/mocks/app/forms.ts'),
          '$app/navigation': resolve(__dirname, '../src/mocks/app/navigation.ts'),
          '$app/stores': resolve(__dirname, '../src/mocks/app/stores.ts'),
        },
      },
    }),
  } satisfies Plugin;
}
