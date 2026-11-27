// @vitest-environment node
import { expect, it, vi } from 'vitest';

import { createDocgenCache, generateDocgen } from './generate-docgen.ts';

// TypeScript 7's `typescript` package exports only its version.
vi.mock('typescript', () => ({ default: { version: '7.0.2' } }));

it('names the fix when the project TypeScript has no compiler API', () => {
  expect(() => generateDocgen('/project/Button.svelte', createDocgenCache())).toThrow(
    'https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0'
  );
});
