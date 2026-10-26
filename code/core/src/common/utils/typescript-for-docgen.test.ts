import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import { type Options, SupportedRenderer } from 'storybook/internal/types';

import { fs as memfs, vol } from 'memfs';

import {
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
import {
  getTypeScriptDocgenApi,
  getTypeScriptForDocgenError,
  isTypeScriptReadyForDocgen,
  loadTypeScriptCompilerApi,
  loadTypeScriptForDocgen,
  typeScriptDocgenApisFor,
  typeScriptPackageForDocgen,
} from './typescript-for-docgen.ts';
import { loadMainConfig } from './load-main-config.ts';

vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('./load-main-config.ts', { spy: true });

const PACKAGE_JSON = '/project/node_modules/typescript/package.json';

const installTypeScript = (version: string) =>
  vol.fromNestedJSON({ [PACKAGE_JSON]: JSON.stringify({ name: 'typescript', version }) });

const resolveInstalled = () => pathToFileURL(PACKAGE_JSON).href;

const moduleNotFound = () =>
  Object.assign(new Error("Cannot find package 'typescript'"), { code: 'ERR_MODULE_NOT_FOUND' });

const resolveMissing = (): string => {
  throw moduleNotFound();
};

const BOTH_APIS = ['compiler', 'native'] as const;

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.mocked(fs.readFileSync).mockImplementation(memfs.readFileSync as typeof fs.readFileSync);
});

describe('getTypeScriptDocgenApi', () => {
  it.each(['5.9.3', '6.0.3'])('TypeScript %s offers the compiler API', (version) => {
    expect(getTypeScriptDocgenApi(version)).toBe('compiler');
  });

  it.each(['7.0.0', '7.0.2'])('TypeScript %s offers no API', (version) => {
    expect(getTypeScriptDocgenApi(version)).toBeUndefined();
  });

  it.each(['7.1.0-beta', '7.1.0', '7.2.3', '8.0.0'])(
    'TypeScript %s offers the native API',
    (version) => {
      expect(getTypeScriptDocgenApi(version)).toBe('native');
    }
  );
});

describe('typeScriptDocgenApisFor', () => {
  it('lets React docgen run on both APIs', () => {
    expect(typeScriptDocgenApisFor(SupportedRenderer.REACT)).toEqual(['compiler', 'native']);
  });

  it.each([
    SupportedRenderer.VUE3,
    SupportedRenderer.SVELTE,
    SupportedRenderer.WEB_COMPONENTS,
    SupportedRenderer.ANGULAR,
  ])('keeps %s docgen on the compiler API', (renderer) => {
    expect(typeScriptDocgenApisFor(renderer)).toEqual(['compiler']);
  });
});

describe('typeScriptPackageForDocgen', () => {
  it('adds TypeScript 7.1 when the native API is supported', () => {
    expect(typeScriptPackageForDocgen(BOTH_APIS)).toBe('typescript@^7.1');
  });

  it('adds TypeScript 6 for the compiler API', () => {
    expect(typeScriptPackageForDocgen(['compiler'])).toBe('typescript@^6');
    expect(typeScriptPackageForDocgen()).toBe('typescript@^6');
  });
});

describe('getTypeScriptForDocgenError', () => {
  it.each(['5.9.3', '6.0.3'])('accepts TypeScript %s', (version) => {
    installTypeScript(version);

    expect(getTypeScriptForDocgenError(resolveInstalled)).toBeUndefined();
  });

  it('reports a missing typescript package', () => {
    expect(getTypeScriptForDocgenError(resolveMissing)).toBeInstanceOf(
      TypeScriptMissingForDocgenError
    );
  });

  it('tells a project that supports the native API to add TypeScript 7.1', () => {
    const error = getTypeScriptForDocgenError(resolveMissing, { apis: BOTH_APIS });

    expect(error?.message).toContain('Add `typescript@^7.1` to the devDependencies');
  });

  it.each([
    ['without a version', JSON.stringify({ name: 'typescript' })],
    ['with a non-string version', JSON.stringify({ name: 'typescript', version: 6 })],
    ['that is not JSON', '{'],
  ])('reports a typescript package.json %s as missing', (_case, packageJson) => {
    vol.fromNestedJSON({ [PACKAGE_JSON]: packageJson });

    expect(getTypeScriptForDocgenError(resolveInstalled)).toBeInstanceOf(
      TypeScriptMissingForDocgenError
    );
  });

  it('reports TypeScript 7 with the side-by-side setup for its version', () => {
    installTypeScript('7.0.2');

    const error = getTypeScriptForDocgenError(resolveInstalled);

    expect(error).toBeInstanceOf(TypeScriptWithoutCompilerApiError);
    expect(error?.message).toContain('"@typescript/native": "npm:typescript@^7.0.2"');
    expect(error?.message).toContain('"typescript": "npm:@typescript/typescript6@^6.0.2"');
    expect(error?.message).toContain('Add `typescript@^6` to the devDependencies');
  });

  it('reports TypeScript 7.1 to a renderer on the compiler API', () => {
    installTypeScript('7.1.0');

    expect(getTypeScriptForDocgenError(resolveInstalled)).toBeInstanceOf(
      TypeScriptWithoutCompilerApiError
    );
  });

  it('accepts TypeScript 7.1 when the native API is supported', () => {
    installTypeScript('7.1.0-beta');

    expect(getTypeScriptForDocgenError(resolveInstalled, { apis: BOTH_APIS })).toBeUndefined();
  });

  it('tells a project that supports the native API to upgrade from TypeScript 7.0', () => {
    installTypeScript('7.0.2');

    const error = getTypeScriptForDocgenError(resolveInstalled, { apis: BOTH_APIS });

    expect(error).toBeInstanceOf(TypeScriptWithoutCompilerApiError);
    expect(error?.message).toContain('TypeScript 7.0 does not include an API');
    expect(error?.message).toContain('Upgrade to `typescript@^7.1`');
    expect(error?.message).not.toContain('@typescript/native');
  });
});

describe('isTypeScriptReadyForDocgen', () => {
  const options = {
    configDir: '/project/.storybook',
    presets: { apply: async () => ({}) } as unknown as Options['presets'],
  };

  beforeEach(() => {
    vi.mocked(once.warn).mockImplementation(() => {});
    vi.mocked(loadMainConfig).mockResolvedValue({ stories: [] });
  });

  it('warns with the fix when typescript cannot be used', async () => {
    await expect(isTypeScriptReadyForDocgen(resolveMissing, options)).resolves.toBe(false);
    expect(once.warn).toHaveBeenCalledWith(new TypeScriptMissingForDocgenError().message);
  });

  it('stays silent when typescript has the compiler API', async () => {
    installTypeScript('6.0.3');

    await expect(isTypeScriptReadyForDocgen(resolveInstalled, options)).resolves.toBe(true);
    expect(once.warn).not.toHaveBeenCalled();
  });

  it('stays silent on TypeScript 7.1 when the native API is supported', async () => {
    installTypeScript('7.1.0');

    await expect(
      isTypeScriptReadyForDocgen(resolveInstalled, options, { apis: BOTH_APIS })
    ).resolves.toBe(true);
    expect(once.warn).not.toHaveBeenCalled();
  });

  describe('when the main config sets docgenServer: false', () => {
    beforeEach(() => {
      vi.mocked(loadMainConfig).mockResolvedValue({
        stories: [],
        features: { docgenServer: false },
      });
    });

    it('stays silent although typescript cannot be used', async () => {
      await expect(isTypeScriptReadyForDocgen(resolveMissing, options)).resolves.toBe(false);
      expect(once.warn).not.toHaveBeenCalled();
    });
  });
});

describe('loadTypeScriptCompilerApi', () => {
  it('returns the default export of a TypeScript 6 module', async () => {
    const typescript = { version: '6.0.3', sys: {} };

    await expect(
      loadTypeScriptCompilerApi(async () => ({ ...typescript, default: typescript }))
    ).resolves.toBe(typescript);
  });

  it.each(['7.0.2', '7.1.0'])('rejects TypeScript %s', async (version) => {
    await expect(loadTypeScriptCompilerApi(async () => ({ version }))).rejects.toThrow(
      TypeScriptWithoutCompilerApiError
    );
  });

  it('rejects a missing typescript package', async () => {
    await expect(
      loadTypeScriptCompilerApi(async () => {
        throw moduleNotFound();
      })
    ).rejects.toThrow(TypeScriptMissingForDocgenError);
  });

  it('rethrows other import failures', async () => {
    const failure = new SyntaxError('Unexpected token');

    await expect(
      loadTypeScriptCompilerApi(async () => {
        throw failure;
      })
    ).rejects.toBe(failure);
  });
});

describe('loadTypeScriptForDocgen', () => {
  const native = { sync: {}, ast: {} };

  it('loads the compiler API of TypeScript 6 without importing the native API', async () => {
    const typescript = { version: '6.0.3', sys: {} };
    const importNativeApi = vi.fn(async () => native);

    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ ...typescript, default: typescript }),
        importNativeApi,
      })
    ).resolves.toEqual({ api: 'compiler', typescript });
    expect(importNativeApi).not.toHaveBeenCalled();
  });

  it('loads the native API of TypeScript 7.1', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ version: '7.1.0-beta' }),
        importNativeApi: async () => native,
      })
    ).resolves.toEqual({ api: 'native', typescript: native });
  });

  it('rejects TypeScript 7.0 with the upgrade hint', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => ({ version: '7.0.2' }),
        importNativeApi: async () => native,
      })
    ).rejects.toThrow('Upgrade to `typescript@^7.1`');
  });

  it('rejects a missing typescript package with the TypeScript 7.1 hint', async () => {
    await expect(
      loadTypeScriptForDocgen({
        importCompilerApi: async () => {
          throw moduleNotFound();
        },
        importNativeApi: async () => native,
      })
    ).rejects.toThrow('Add `typescript@^7.1` to the devDependencies');
  });
});
