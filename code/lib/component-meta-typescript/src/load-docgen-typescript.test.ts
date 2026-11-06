import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadDocgenTypeScript, loadTypeScriptForDocgen } from './load-docgen-typescript.ts';

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

describe('loadTypeScriptForDocgen', () => {
  const moduleNotFound = () =>
    Object.assign(new Error("Cannot find package 'typescript'"), { code: 'ERR_MODULE_NOT_FOUND' });

  // A TypeScript whose main module has `version`, and whose other entry points are empty modules.
  const typeScriptWith = (version: string) =>
    vi.fn(async (subpath: string) => (subpath === '.' ? { version } : { subpath }));

  beforeEach(() => {
    vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'true');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads the compiler API of TypeScript 6 without importing the native API', async () => {
    const typescript = { version: '6.0.3', sys: {} };
    const importEntry = vi.fn(async () => ({ ...typescript, default: typescript }));

    await expect(loadTypeScriptForDocgen(importEntry)).resolves.toEqual({
      api: 'compiler',
      typescript,
    });
    expect(importEntry).toHaveBeenCalledTimes(1);
  });

  it('loads every native module of TypeScript 7.1', async () => {
    await expect(loadTypeScriptForDocgen(typeScriptWith('7.1.0-beta'))).resolves.toEqual({
      api: 'native',
      typescript: {
        sync: { subpath: './sync' },
        ast: { subpath: './ast' },
        factory: { subpath: './ast/factory' },
      },
    });
  });

  it('rejects TypeScript 7.0 with the upgrade hint', async () => {
    await expect(loadTypeScriptForDocgen(typeScriptWith('7.0.2'))).rejects.toThrow(
      'Upgrade to `typescript@^7.1`'
    );
  });

  it('rejects a missing typescript package with the TypeScript 7.1 hint', async () => {
    await expect(
      loadTypeScriptForDocgen(async () => {
        throw moduleNotFound();
      })
    ).rejects.toThrow('Add `typescript@^7.1` to the devDependencies');
  });

  describe('before TypeScript 7.1 is stable', () => {
    beforeEach(() => {
      vi.stubEnv('STORYBOOK_TYPESCRIPT_7_1_STABLE', 'false');
    });

    it('rejects TypeScript 7.0 with the side-by-side setup', async () => {
      await expect(loadTypeScriptForDocgen(typeScriptWith('7.0.2'))).rejects.toThrow(
        '"typescript": "npm:@typescript/typescript6@^6.0.2"'
      );
    });

    it('still loads the native API of an installed TypeScript 7.1', async () => {
      await expect(loadTypeScriptForDocgen(typeScriptWith('7.1.0-beta'))).resolves.toMatchObject({
        api: 'native',
      });
    });
  });
});
