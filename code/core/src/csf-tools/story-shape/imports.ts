import { type NodePath, types as t } from 'storybook/internal/babel';

export interface ImportBinding {
  /** Module specifier the local name is imported from. */
  importId: string;
  /** Original export name; `'default'` or `'*'` for default/namespace imports. */
  importName: string;
}

/** True for `import { type X }` specifiers, which carry no runtime binding. */
export const isTypeSpecifier = (
  s: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier
): boolean => t.isImportSpecifier(s) && s.importKind === 'type';

/** Exported name behind an import specifier, incl. string-named exports. */
export const importedName = (im: t.Identifier | t.StringLiteral): string =>
  t.isIdentifier(im) ? im.name : im.value;

/** Map of local identifier → import binding for a file's value imports (type-only skipped). */
export function collectImportBindings(program: NodePath<t.Program>): Map<string, ImportBinding> {
  const localToImport = new Map<string, ImportBinding>();

  for (const stmt of program.get('body')) {
    if (!stmt.isImportDeclaration()) {
      continue;
    }
    const decl = stmt.node;

    if (decl.importKind === 'type') {
      continue;
    }

    for (const s of decl.specifiers ?? []) {
      if (!('local' in s) || !s.local || isTypeSpecifier(s)) {
        continue;
      }

      const importId = decl.source.value;
      if (t.isImportDefaultSpecifier(s)) {
        localToImport.set(s.local.name, { importId, importName: 'default' });
      } else if (t.isImportNamespaceSpecifier(s)) {
        localToImport.set(s.local.name, { importId, importName: '*' });
      } else if (t.isImportSpecifier(s)) {
        localToImport.set(s.local.name, { importId, importName: importedName(s.imported) });
      }
    }
  }

  return localToImport;
}
