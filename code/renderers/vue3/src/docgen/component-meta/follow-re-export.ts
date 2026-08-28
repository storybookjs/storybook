import type { ComponentMetaChecker } from 'vue-component-meta';

export interface ReExportTarget {
  path: string;
  exportName: string;
}

/**
 * Follow a re-export to the module that actually declares the component.
 *
 * A design system's stories import from its public entry point, so `meta.component` routinely
 * resolves to a barrel. `vue-component-meta` looks for the declaration inside the file it is handed
 * and finds only an export specifier there, so without this a barrel import yields no docgen at all
 * while a direct import of the same component yields a full props table.
 *
 * Returns `undefined` when the file declares the export itself, which is the common case.
 */
export function followReExport(
  checker: ComponentMetaChecker,
  filePath: string,
  exportName: string
): ReExportTarget | undefined {
  const program = checker.getProgram();
  const sourceFile = program?.getSourceFile(filePath);
  if (!program || !sourceFile) {
    return undefined;
  }

  const typeChecker = program.getTypeChecker();
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return undefined;
  }

  const exported = typeChecker
    .getExportsOfModule(moduleSymbol)
    .find((symbol) => symbol.name === exportName);
  if (!exported) {
    return undefined;
  }

  let target;
  try {
    // Throws rather than returning undefined for a symbol that is not an alias, which is how a
    // locally declared export gets here.
    target = typeChecker.getAliasedSymbol(exported);
  } catch {
    return undefined;
  }

  const declaringPath = target.declarations?.[0]?.getSourceFile().fileName;
  if (!declaringPath || declaringPath === filePath) {
    return undefined;
  }
  return { path: declaringPath, exportName: target.name };
}
