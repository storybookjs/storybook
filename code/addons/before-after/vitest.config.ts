import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// The addon's node-side tests boot a real Vite dev server and exercise
// `oxc-parser`/`magic-string` directly. They do not need the workspace-wide
// vitest setup file (which mocks compiled storybook internals); using a
// standalone config keeps the test runtime self-contained.
export default defineConfig({
  test: {
    name: 'addon-before-after',
    root: resolve(__dirname),
    passWithNoTests: true,
    clearMocks: true,
    globals: false,
    testTimeout: 30000,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    alias: {
      // Stub the storybook node-logger so tests don't require a compiled core.
      'storybook/internal/node-logger': resolve(
        __dirname,
        'src/node/__tests__/__mocks__/node-logger.ts'
      ),
      'storybook/internal/channels': resolve(__dirname, 'src/node/__tests__/__mocks__/channels.ts'),
    },
  },
});
