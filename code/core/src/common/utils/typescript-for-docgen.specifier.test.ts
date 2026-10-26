// Resolves real packages of the monorepo: a bare specifier goes through Node's own resolver, which
// memfs cannot stand in for. `typescript-native` is TypeScript 7.1, `typescript` is TypeScript 6.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { dirname, relative } from 'pathe';

import {
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from '../../server-errors.ts';
import {
  getTypeScriptForDocgenError,
  getTypeScriptSpecifierForDocgen,
  isTypeScriptReadyForDocgen,
  readTypeScriptPackageForDocgen,
} from './typescript-for-docgen.ts';

const configDir = import.meta.dirname;
const nativePackageDir = dirname(
  createRequire(import.meta.url).resolve('typescript-native/package.json')
);
const BOTH_APIS = ['compiler', 'native'] as const;

const presetsWith = (typescript: object) =>
  ({ apply: async () => typescript }) as unknown as Options['presets'];

describe('getTypeScriptSpecifierForDocgen', () => {
  it('is undefined when the main config sets no docgenSpecifier', async () => {
    await expect(
      getTypeScriptSpecifierForDocgen({ configDir, presets: presetsWith({}) })
    ).resolves.toBeUndefined();
  });

  it('pairs the docgenSpecifier with the config directory it resolves from', async () => {
    await expect(
      getTypeScriptSpecifierForDocgen({
        configDir,
        presets: presetsWith({ docgenSpecifier: '@typescript/native' }),
      })
    ).resolves.toEqual({ specifier: '@typescript/native', configDir });
  });
});

describe('readTypeScriptPackageForDocgen', () => {
  it.each([
    ['a package name', 'typescript-native'],
    ['a path relative to the config directory', relative(configDir, nativePackageDir)],
    ['an absolute path', nativePackageDir],
    ['a file URL', pathToFileURL(nativePackageDir).href],
  ])('reads TypeScript 7.1 from %s', async (_kind, specifier) => {
    const { version, importEntry } = readTypeScriptPackageForDocgen({ specifier, configDir });

    expect(version).toMatch(/^7\.1\./);
    expect(await importEntry('./sync')).toHaveProperty('API');
  });

  it('imports the compiler API from a TypeScript 6 package without exports', async () => {
    const { version, importEntry } = readTypeScriptPackageForDocgen({
      specifier: 'typescript',
      configDir,
    });

    expect(version).toMatch(/^6\./);
    expect(await importEntry('.')).toHaveProperty('default.createProgram');
  });

  it.each([
    ['a package that is not installed', '@typescript/not-installed'],
    ['a subpath of a package', 'typescript-native/sync'],
  ])('names the option when the specifier is %s', (_kind, specifier) => {
    expect(() => readTypeScriptPackageForDocgen({ specifier, configDir })).toThrow(
      TypeScriptMissingForDocgenError
    );
    expect(() => readTypeScriptPackageForDocgen({ specifier, configDir })).toThrow(
      new TypeScriptMissingForDocgenError({ specifier }).message
    );
  });
});

describe('getTypeScriptForDocgenError with a docgenSpecifier', () => {
  const resolveNothing = () => {
    throw new Error('the `typescript` package must not be read when a specifier is set');
  };

  it('accepts TypeScript 7.1 at the specifier for docgen that supports the native API', () => {
    expect(
      getTypeScriptForDocgenError(resolveNothing, {
        apis: BOTH_APIS,
        typeScriptSpecifier: { specifier: 'typescript-native', configDir },
      })
    ).toBeUndefined();
  });

  it('names the option when the package at the specifier has no usable API', () => {
    const error = getTypeScriptForDocgenError(resolveNothing, {
      apis: ['compiler'],
      typeScriptSpecifier: { specifier: 'typescript-native', configDir },
    });

    expect(error).toBeInstanceOf(TypeScriptWithoutCompilerApiError);
    expect(error?.message).toContain('`typescript.docgenSpecifier`');
  });

  it('reports a specifier that names no package', () => {
    expect(
      getTypeScriptForDocgenError(resolveNothing, {
        apis: BOTH_APIS,
        typeScriptSpecifier: { specifier: '@typescript/not-installed', configDir },
      })
    ).toBeInstanceOf(TypeScriptMissingForDocgenError);
  });
});

describe('isTypeScriptReadyForDocgen', () => {
  const resolveTypeScript6 = (specifier: string) =>
    pathToFileURL(createRequire(import.meta.url).resolve(specifier)).href;
  const options = {
    configDir,
    presets: presetsWith({ docgenSpecifier: 'typescript-native' }),
  };

  it('checks the package the docgenSpecifier names for docgen on the native API', async () => {
    await expect(
      isTypeScriptReadyForDocgen(resolveTypeScript6, options, { apis: ['native'] })
    ).resolves.toBe(true);
  });

  it('checks `typescript` for docgen on the compiler API alone', async () => {
    await expect(
      isTypeScriptReadyForDocgen(resolveTypeScript6, options, { apis: ['compiler'] })
    ).resolves.toBe(true);
  });
});
