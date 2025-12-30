import type { Options } from 'storybook/internal/types';

import type { UserConfig } from 'vite';

// This preset defines currently mocking plugins for Vite
// It is defined as a viteFinal preset so that @storybook/addon-vitest can use it as well and that it doesn't have to be duplicated in addon-vitest.
// The main vite configuration is defined in `./vite-config.ts`.
export async function viteFinal(existing: UserConfig, options: Options) {
  // Mocking functionality has been disabled
  return {
    ...existing,
    plugins: [...(existing.plugins ?? [])],
  };
}
