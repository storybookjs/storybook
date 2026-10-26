import {
  type LoadedTypeScriptForDocgen,
  type TypeScriptSpecifierForDocgen,
  loadTypeScriptForDocgen,
  readTypeScriptPackageForDocgen,
} from 'storybook/internal/common';

import type ts from 'typescript';

import type { NativeTypeScriptModules } from './native/native-typescript.ts';

export type LoadedDocgenTypeScript = LoadedTypeScriptForDocgen<typeof ts, NativeTypeScriptModules>;

/** The `typescript` a component-meta manager runs on: the compiler API's module, or either loaded API. */
export type ComponentMetaTypeScript = typeof ts | LoadedDocgenTypeScript;

/**
 * Load the TypeScript docgen runs on, with the API its version offers: the package
 * `typescript.docgenSpecifier` names, or else the `typescript` peer of the renderer this is bundled
 * into.
 */
export function loadDocgenTypeScript(
  typeScriptSpecifier?: TypeScriptSpecifierForDocgen
): Promise<LoadedDocgenTypeScript> {
  if (typeScriptSpecifier) {
    const { importEntry } = readTypeScriptPackageForDocgen(typeScriptSpecifier, [
      'compiler',
      'native',
    ]);
    return loadTypeScriptForDocgen({
      importCompilerApi: () => importEntry('.') as Promise<typeof ts>,
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
