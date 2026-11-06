import { pathToFileURL } from 'node:url';

import {
  type TypeScriptDocgenApi,
  type TypeScriptPackageForDocgen,
  type TypeScriptSpecifierForDocgen,
  getTypeScriptDocgenApi,
  isModuleNotFoundError,
  isTypeScriptUsableForDocgen,
  readTypeScriptPackageForDocgen,
} from 'storybook/internal/common';
import {
  TypeScriptMissingForDocgenError,
  TypeScriptWithoutCompilerApiError,
} from 'storybook/internal/server-errors';

import { join } from 'pathe';
import type ts from 'typescript';

import type { NativeTypeScriptModules } from './native/native-typescript.ts';

export type LoadedDocgenTypeScript =
  | { api: 'compiler'; typescript: typeof ts }
  | { api: 'native'; typescript: NativeTypeScriptModules };

const DOCGEN_APIS: readonly TypeScriptDocgenApi[] = ['compiler', 'native'];

// Import an entry point of a TypeScript package by its subpath, such as `.` or `./sync`.
export type ImportTypeScriptEntry = (subpath: string) => Promise<unknown>;

// The native API's modules, by the subpath of their entry point.
const NATIVE_ENTRY_POINTS = { sync: './sync', ast: './ast', factory: './ast/factory' } as const;

// Import the modules of TypeScript 7.1's native API.
export async function loadNativeTypeScriptModules(
  importEntry: ImportTypeScriptEntry
): Promise<NativeTypeScriptModules> {
  const [sync, ast, factory] = await Promise.all(
    Object.values(NATIVE_ENTRY_POINTS).map((subpath) => importEntry(subpath))
  );
  return { sync, ast, factory } as NativeTypeScriptModules;
}

// Import the API that a TypeScript offers docgen: the compiler API of TypeScript 5.9 and 6, or the
// native API of TypeScript 7.1 and newer. The main module of every version exports `version`, so
// it is imported first and decides which API to load. `specifier` is the package `importEntry`
// loads from when it is not `typescript`, so the errors name it.
export async function loadTypeScriptForDocgen(
  importEntry: ImportTypeScriptEntry,
  specifier?: string
): Promise<LoadedDocgenTypeScript> {
  let typescript: typeof ts;
  try {
    const imported = (await importEntry('.')) as typeof ts & { default?: typeof ts };
    typescript = imported.default ?? imported;
  } catch (cause) {
    if (isModuleNotFoundError(cause)) {
      throw new TypeScriptMissingForDocgenError({ cause, apis: DOCGEN_APIS });
    }
    throw cause;
  }
  const { version } = typescript;
  if (!isTypeScriptUsableForDocgen(version, DOCGEN_APIS)) {
    throw new TypeScriptWithoutCompilerApiError({ version, apis: DOCGEN_APIS, specifier });
  }
  return getTypeScriptDocgenApi(version) === 'native'
    ? { api: 'native', typescript: await loadNativeTypeScriptModules(importEntry) }
    : { api: 'compiler', typescript };
}

// A path is not a package specifier, so Node would not apply the package's `exports` to
// `<path>/sync`; the entry points are read from its package.json instead, for every specifier.
const importPackageEntry = (
  { version, packageDir, main, exports }: TypeScriptPackageForDocgen,
  subpath: string
): Promise<unknown> => {
  const entry = exports ? exports[subpath] : subpath === '.' ? (main ?? 'index.js') : undefined;
  if (typeof entry !== 'string') {
    throw new Error(
      `TypeScript ${version} at ${packageDir} has no "${subpath}" entry point that Storybook can import`
    );
  }
  return import(pathToFileURL(join(packageDir, entry)).href);
};

// Load the TypeScript docgen runs on, with the API its version offers: the package
// `typescript.docgenSpecifier` names, or else the `typescript` peer of the renderer this is bundled
// into.
export function loadDocgenTypeScript(
  typeScriptSpecifier?: TypeScriptSpecifierForDocgen
): Promise<LoadedDocgenTypeScript> {
  if (typeScriptSpecifier) {
    const typeScriptPackage = readTypeScriptPackageForDocgen(typeScriptSpecifier, DOCGEN_APIS);
    return loadTypeScriptForDocgen(
      (subpath) => importPackageEntry(typeScriptPackage, subpath),
      typeScriptSpecifier.specifier
    );
  }
  return loadTypeScriptForDocgen((subpath) => import(`typescript${subpath.slice(1)}`));
}
