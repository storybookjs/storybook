// @vitest-environment node
import { readFileSync } from 'node:fs';

import { expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// The project owns the TypeScript that the docgen engine and svelte2tsx use. On TypeScript 7, the
// startup check warns with the side-by-side setup, because TypeScript 7 has no compiler API.
it('takes TypeScript from the project as a required peer dependency', () => {
  expect(manifest.peerDependencies.typescript).toBe('^5.9.0 || ^6.0.0 || ^7.0.0');
  expect(manifest.peerDependenciesMeta ?? {}).not.toHaveProperty('typescript');
  expect(manifest.dependencies).not.toHaveProperty('typescript');
});
