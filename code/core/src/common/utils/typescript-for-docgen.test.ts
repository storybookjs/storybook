import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';

import { fs as memfs, vol } from 'memfs';

import {
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
import {
  getTypeScriptForDocgenError,
  isTypeScriptReadyForDocgen,
  loadTypeScriptCompilerApi,
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

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.mocked(fs.readFileSync).mockImplementation(memfs.readFileSync as typeof fs.readFileSync);
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
});

describe('isTypeScriptReadyForDocgen', () => {
  const options = { configDir: '/project/.storybook' };

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

  it('rejects TypeScript 7', async () => {
    await expect(loadTypeScriptCompilerApi(async () => ({ version: '7.0.2' }))).rejects.toThrow(
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
