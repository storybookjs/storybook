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

// The `typescript` a component-meta manager runs on: the compiler API's module, or either loaded API.
export type ComponentMetaTypeScript = typeof ts | LoadedDocgenTypeScript;

const DOCGEN_APIS: readonly TypeScriptDocgenApi[] = ['compiler', 'native'];

// Import the API that a TypeScript offers docgen: the compiler API of TypeScript 5.9 and 6, or the
// native API of TypeScript 7.1 and newer. The main module of every version exports `version`, so
// the compiler importer runs first and decides which API to load. `specifier` is the package the
// importers load from when it is not `typescript`, so the errors name it.
export async function loadTypeScriptForDocgen({
  importCompilerApi,
  importNativeApi,
  specifier,
}: {
  importCompilerApi: () => Promise<unknown>;
  importNativeApi: () => Promise<NativeTypeScriptModules>;
  specifier?: string;
}): Promise<LoadedDocgenTypeScript> {
  let typescript: typeof ts;
  try {
    const imported = (await importCompilerApi()) as typeof ts & { default?: typeof ts };
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
    ? { api: 'native', typescript: await importNativeApi() }
    : { api: 'compiler', typescript };
}

// A path is not a package specifier, so Node would not apply the package's `exports` to
// `<path>/sync`; the entry points are read from its package.json instead, for every specifier.
const importPackageEntry = (
  { version, packageDir, main, exports }: TypeScriptPackageForDocgen,
  subpath: string
) => {
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
    const importEntry = (subpath: string) => importPackageEntry(typeScriptPackage, subpath);
    return loadTypeScriptForDocgen({
      importCompilerApi: () => importEntry('.'),
      importNativeApi: async () =>
        ({
          sync: await importEntry('./sync'),
          ast: await importEntry('./ast'),
          factory: await importEntry('./ast/factory'),
        }) as NativeTypeScriptModules,
      specifier: typeScriptSpecifier.specifier,
    });
  }
  return loadTypeScriptForDocgen({
    importCompilerApi: () => import('typescript'),
    importNativeApi: async () => {
      // @ts-expect-error -- TypeScript 7.1 has these subpaths; the workspace's TypeScript 6 does not.
      const sync = await import('typescript/sync');
      // @ts-expect-error -- see above.
      const ast = await import('typescript/ast');
      // @ts-expect-error -- see above.
      const factory = await import('typescript/ast/factory');
      return { sync, ast, factory } as NativeTypeScriptModules;
    },
  });
}
