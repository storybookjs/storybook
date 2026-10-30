import { describe, expect, it } from 'vitest';

import { loadDocgenTypeScript } from './load-docgen-typescript.ts';

// `typescript-native` is TypeScript 7.1 and `typescript` TypeScript 6, both of this package.
const configDir = import.meta.dirname;

describe('loadDocgenTypeScript', () => {
  it('loads the compiler API of `typescript` without a docgenSpecifier', async () => {
    const loaded = await loadDocgenTypeScript();

    expect(loaded.api).toBe('compiler');
    expect(loaded.api === 'compiler' && loaded.typescript.version).toMatch(/^6\./);
  });

  it('loads the native API with every module the facade needs from a TypeScript 7.1 specifier', async () => {
    const loaded = await loadDocgenTypeScript({ specifier: 'typescript-native', configDir });

    expect(loaded.api).toBe('native');
    expect(loaded.api === 'native' && loaded.typescript).toMatchObject({
      sync: { API: expect.any(Function) },
      ast: { isIdentifier: expect.any(Function) },
      factory: { createStringLiteral: expect.any(Function) },
    });
  });

  it('loads the compiler API from a TypeScript 6 specifier', async () => {
    const loaded = await loadDocgenTypeScript({ specifier: 'typescript', configDir });

    expect(loaded.api).toBe('compiler');
  });
});
