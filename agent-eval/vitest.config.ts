import { configDefaults, coverageConfigDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'agent-eval',
    // .eval-cache/ contains the external repo when using `setupExternalRepo`.
    // results/ contains post-eval project trees copied out of each run.
    // .agentic-ref/ symlinks both into the generated work directory.
    exclude: [...configDefaults.exclude, '.eval-cache/**', 'results/**', '.agentic-ref/**'],
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
