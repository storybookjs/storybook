import { types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';

import { jsTsSourceExtensions } from '../../shared/constants/extensions.ts';
import { createModuleResolver } from './module-resolver.ts';

/** The component a story file documents, as far as static analysis can determine. */
export interface ResolvedMetaComponent {
  /** Local identifier `meta.component` refers to in the story file. */
  localName: string;
  /** Specifier the component is imported from, or `undefined` when it is declared in the story file. */
  importId?: string;
  /**
   * Absolute path of the module declaring the component, or `undefined` when the specifier does not
   * resolve on disk. Set to the story file itself for a component declared there.
   */
  path?: string;
  /**
   * Export name inside that module: `default` for a default import, the imported name for a named
   * one (so an alias resolves to what the module actually exports), and the local name for a
   * component declared in the story file.
   */
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
 * Server-side docgen never loads the story module, so it cannot read a class or component object's
 * runtime name the way a preview can. It has only the source, where `meta.component` is a local
 * binding whose name may not match what the module exports. Recovering the exported name, and the
 * file it comes from, is what lets a docgen engine find the right entry when several share a name.
 *
 * The resolver is created once per host because it caches; `tsconfig: 'auto'` honours `paths` and
 * `baseUrl`, which projects routinely alias their own sources through.
 */
export function createMetaComponentResolver(options: MetaComponentResolverOptions = {}) {
  const resolver = createModuleResolver({
    extensions: [...(options.extensions ?? []), ...jsTsSourceExtensions],
    mainFields: ['module', 'main'],
    tsconfig: 'auto',
  });

  return function resolveMetaComponent(csf: CsfFile, storyPath: string): MetaComponentResolution {
    const localName = csf._meta?.component;
    if (!localName) {
      return { reason: 'no-meta-component' };
    }

    const binding = findImport(csf, localName);
    if (binding.kind === 'unsupported') {
      return { reason: 'no-component-import' };
    }

    // Nothing imports the name, so the component is declared in the story file itself. That is a
    // real location, and reporting it lets a caller explain why its engine has no entry for it.
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

/** Finds the import declaration that binds `localName`, and the export name it pulls in. */
function findImport(csf: CsfFile, localName: string): ImportBinding {
  for (const statement of csf._file.path.get('body')) {
    if (!statement.isImportDeclaration()) {
      continue;
    }

    for (const specifier of statement.node.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }

      // A type-only import or `import * as ns` binds nothing a docgen engine could have documented,
      // but it does mean the name is imported rather than declared here.
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
