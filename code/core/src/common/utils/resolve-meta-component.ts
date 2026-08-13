import { types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';

import { jsTsSourceExtensions } from '../../shared/constants/extensions.ts';
import { createModuleResolver } from './module-resolver.ts';

/** The component a story file documents, as far as static analysis can determine. */
export interface ResolvedMetaComponent {
  /** Local identifier `meta.component` refers to in the story file. */
  localName: string;
  /** Specifier the component is imported from, or `undefined` when it is declared in the file. */
  importId?: string;
  /** Declaring module, or the story file itself; `undefined` when the import does not resolve. */
  path?: string;
  /** Export name in the declaring module, so an import alias resolves to the real export. */
  exportName: string;
}

/** Why a story file yielded no component. */
export type UnresolvedMetaComponentReason = 'no-meta-component' | 'no-component-import';

export type MetaComponentResolution =
  | { component: ResolvedMetaComponent }
  | { reason: UnresolvedMetaComponentReason };

export interface MetaComponentResolverOptions {
  /** Extensions tried ahead of the JS/TS set, for single-file-component formats like `.vue`. */
  extensions?: string[];
}

/**
 * Builds a resolver that locates the component behind `meta.component` in a parsed CSF file.
 *
 * Server-side docgen never loads the story module, so the exported name and declaring file have to
 * be recovered from source; the resolver caches, so create one per host rather than per call.
 */
export function createMetaComponentResolver(options: MetaComponentResolverOptions = {}) {
  const resolver = createModuleResolver({
    extensions: [...(options.extensions ?? []), ...jsTsSourceExtensions],
    mainFields: ['module', 'main'],
    tsconfig: 'auto',
  });

  return function resolveMetaComponent(csf: CsfFile, storyPath: string): MetaComponentResolution {
    // `_meta.component` is printed source text, so only the parsed node shows whether the value is
    // a followable identifier, possibly wrapped in type arguments as in `Comp<Props>`.
    const node = csf._metaAnnotations.component;
    const identifier = node && t.isTSInstantiationExpression(node) ? node.expression : node;
    if (!identifier || !t.isIdentifier(identifier)) {
      return { reason: 'no-meta-component' };
    }
    const localName = identifier.name;

    const binding = findImport(csf, localName);
    if (binding.kind === 'unsupported') {
      return { reason: 'no-component-import' };
    }

    // A component declared in the story file is a real location, so reporting it lets a caller
    // explain why its docgen engine has no entry for it.
    if (binding.kind === 'local') {
      return { component: { localName, exportName: localName, path: storyPath } };
    }

    const { importId, exportName } = binding;
    let path: string | undefined;
    try {
      path = resolver.resolveFileSync(storyPath, importId);
    } catch {
      path = undefined;
    }

    return { component: { localName, importId, exportName, path } };
  };
}

type ImportBinding =
  | { kind: 'import'; importId: string; exportName: string }
  | { kind: 'local' }
  | { kind: 'unsupported' };

function findImport(csf: CsfFile, localName: string): ImportBinding {
  for (const statement of csf._file.path.get('body')) {
    if (!statement.isImportDeclaration()) {
      continue;
    }

    for (const specifier of statement.node.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }

      // A type-only or namespace import binds nothing documentable, but the name is still imported
      // rather than declared here.
      if (statement.node.importKind === 'type' || t.isImportNamespaceSpecifier(specifier)) {
        return { kind: 'unsupported' };
      }

      const importId = statement.node.source.value;
      if (t.isImportDefaultSpecifier(specifier)) {
        return { kind: 'import', importId, exportName: 'default' };
      }
      if (specifier.importKind === 'type') {
        return { kind: 'unsupported' };
      }
      return {
        kind: 'import',
        importId,
        exportName: t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value,
      };
    }
  }

  return { kind: 'local' };
}
