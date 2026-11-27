import { expect, test } from 'vitest';

// Wiring smoke test: proves this package's vitest project is discovered and
// executed in CI before the recorders (Stories 1.4-1.6) and seam tests (1.7)
// land on this surface. Replaced by real tests as they arrive.
test('docgen-harness package resolves', async () => {
  await expect(import('./index.ts')).resolves.toBeDefined();
});
