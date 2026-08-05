import { types as t } from 'storybook/internal/babel';
import { createModuleResolver, jsTsSourceExtensions } from 'storybook/internal/common';
import type { CsfFile } from 'storybook/internal/csf-tools';

/** The component a story file documents, located on disk. */
export interface ResolvedVueComponent {
  /** Local identifier `meta.component` refers to in the story file. */
  localName: string;
  /** Specifier the component is imported from, as written in the story file. */
  importId: string;
  /** Absolute path of the module the component is imported from. */
  path: string;
  /** Export name inside that module — `default` for a default import. */
  exportName: string;
}

const componentResolver = createModuleResolver({
  extensions: ['.vue', ...jsTsSourceExtensions],
  mainFields: ['module', 'main'],
  tsconfig: 'auto',
});

/** Reason a story file yielded no component to extract docgen from. */
export type UnresolvedComponentReason = 'no-meta-component' | 'no-component-import';

/**
 * Locates the component behind `meta.component` in a parsed CSF file.
 */
export function resolveMetaComponent(
  csf: CsfFile,
  storyPath: string
): { component: ResolvedVueComponent } | { reason: UnresolvedComponentReason } {
  const localName = csf._meta?.component;
  if (!localName) {
    return { reason: 'no-meta-component' };
  }

  const imported = findImport(csf, localName);
  if (!imported) {
    return { reason: 'no-component-import' };
  }

  let resolvedPath: string | undefined;
  try {
    resolvedPath = componentResolver.resolveFileSync(storyPath, imported.importId);
  } catch {
    resolvedPath = undefined;
  }
  if (!resolvedPath) {
    return { reason: 'no-component-import' };
  }

  return { component: { localName, ...imported, path: resolvedPath } };
}

/** Finds the import declaration that binds `localName`, and the export name it pulls in. */
function findImport(
  csf: CsfFile,
  localName: string
): { importId: string; exportName: string } | undefined {
  for (const statement of csf._file.path.get('body')) {
    if (!statement.isImportDeclaration() || statement.node.importKind === 'type') {
      continue;
    }

    for (const specifier of statement.node.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }
      const importId = statement.node.source.value;

      if (t.isImportDefaultSpecifier(specifier)) {
        return { importId, exportName: 'default' };
      }
      if (t.isImportSpecifier(specifier) && specifier.importKind !== 'type') {
        return {
          importId,
          exportName: t.isIdentifier(specifier.imported)
            ? specifier.imported.name
            : specifier.imported.value,
        };
      }
      // ignore import *...
      return undefined;
    }
  }

  return undefined;
}
