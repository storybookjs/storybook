import type { E } from '../estree/ast.ts';

export interface ImportBinding {
  /** Module specifier the local name is imported from. */
  importId: string;
  /** Original export name; `'default'` or `'*'` for default/namespace imports. */
  importName: string;
}

/** True for `import { type X }` specifiers, which carry no runtime binding. */
export const isTypeSpecifier = (
  s: E.ImportSpecifier | E.ImportDefaultSpecifier | E.ImportNamespaceSpecifier
): boolean => s.type === 'ImportSpecifier' && s.importKind === 'type';

/** Exported name behind an import specifier, incl. string-named exports. */
export const importedName = (im: E.ModuleExportName): string =>
  im.type === 'Identifier' ? im.name : (im as E.StringLiteral).value;

/** Map of local identifier → import binding for a file's value imports (type-only skipped). */
export function collectImportBindings(program: E.Program): Map<string, ImportBinding> {
  const localToImport = new Map<string, ImportBinding>();

  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
      continue;
    }
    const importId = statement.source.value;
    for (const s of statement.specifiers) {
      if (isTypeSpecifier(s)) {
        continue;
      }
      if (s.type === 'ImportDefaultSpecifier') {
        localToImport.set(s.local.name, { importId, importName: 'default' });
      } else if (s.type === 'ImportNamespaceSpecifier') {
        localToImport.set(s.local.name, { importId, importName: '*' });
      } else {
        localToImport.set(s.local.name, { importId, importName: importedName(s.imported) });
      }
    }
  }

  return localToImport;
}
