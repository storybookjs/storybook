import { fileURLToPath } from 'node:url';

import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Live-types convention (mirrors the @storybook/mcp path mapping in
      // tsconfig.json): resolve straight to source, never the gitignored
      // dist/ build output. vite-tsconfig-paths would do this too, but
      // agent-eval carries its own nested vite (via next) whose Plugin
      // type conflicts with the root vite that plugin resolves against —
      // a plain alias sidesteps that entirely.
      '@storybook/agent-eval-utils': fileURLToPath(
        new URL('./utils/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    name: 'agent-eval',
    // .eval-cache/ contains the external repo when using `setupExternalRepo`.
    // results/ contains post-eval project trees copied out of each run.
    // .agentic-ref/ symlinks both into the generated work directory.
    // utils/ is its own vitest project (registered in the root config).
    exclude: [
      ...configDefaults.exclude,
      '.eval-cache/**',
      'results/**',
      '.agentic-ref/**',
      'utils/**',
    ],
    coverage: {
      reportOnFailure: true,
      provider: 'v8',
      // lib/ is the reusable library code under test. scripts/ are one-off CLI
      // entry points and evals/templates are fixtures, so they stay out.
      include: ['lib/**/*.ts'],
      exclude: [...coverageConfigDefaults.exclude, 'lib/test-utils.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
