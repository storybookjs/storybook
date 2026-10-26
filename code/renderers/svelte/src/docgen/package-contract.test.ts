// @vitest-environment node
import { readFileSync } from 'node:fs';

import { expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

// TypeScript 7 has no compiler API. A peer would let pnpm and Yarn link the project's TypeScript 7
// in place of the renderer's own copy, for the docgen engine and for svelte2tsx.
it('gives the docgen engine its own TypeScript with the compiler API', () => {
  expect(manifest.dependencies.typescript).toBe('^5.9.0 || ^6.0.0');
  expect(manifest.peerDependencies).not.toHaveProperty('typescript');
});
