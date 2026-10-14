import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { docgenTypeScript } from './docgen-typescript.ts';

const require = createRequire(import.meta.url);

describe('docgenTypeScript', () => {
  it('loads a TypeScript module that has the compiler API and points svelte2tsx at it', () => {
    expect(typeof docgenTypeScript?.sys.fileExists).toBe('function');

    const typescriptFromSvelte2tsx = createRequire(require.resolve('svelte2tsx'))(
      'typescript'
    ) as typeof import('typescript');

    expect(typescriptFromSvelte2tsx).toBe(docgenTypeScript);
  });
});
