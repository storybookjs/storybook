import { type NodePath, types as t } from 'storybook/internal/babel';
import type { CsfFile } from 'storybook/internal/csf-tools';

import { parseReferenceModule } from '../../csf-tools/story-shape/reference-context.ts';
import { isSelfContained } from '../../csf-tools/story-shape/resolve-arg-value.ts';
import {
  type ReferenceModule,
  resolveReferencedValue,
  sourceOf,
} from '../../csf-tools/story-shape/resolve-members.ts';
import { unwrapExpression } from '../../csf-tools/story-shape/utils.ts';
import { jsTsSourceExtensions } from '../../shared/constants/extensions.ts';
import { createModuleResolver } from './module-resolver.ts';

/** The component a story file documents, as far as static analysis can determine. */
export interface ResolvedMetaComponent {
  /** Local identifier the component is bound to, in the module that names it. */
  localName: string;
  /** Specifier the component is imported from, or `undefined` when it is declared in the file. */
  importId?: string;
  /** Declaring module, or the naming module itself; `undefined` when the import does not resolve. */
  path?: string;
  /** Export name in the declaring module, so an import alias resolves to the real export. */
  exportName: string;
}

export type MetaComponentResolution =
  | { component: ResolvedMetaComponent }
  | { reason: 'no-meta-component' | 'no-component-import' }
  | {
      reason: 'unreadable-component-expression';
      /** Source text of the expression, so a caller can name what it could not follow. */
      expression: string;
    };

export interface MetaComponentResolverOptions {
  /** Extensions tried ahead of the JS/TS set, for single-file-component formats like `.vue`. */
  extensions?: string[];
}

/** Peels the type-level wrappers off a component expression, as in `Comp<Props>` or `Comp as any`. */
const unwrapComponentExpression = (node: t.Node): t.Node => {
  const unwrapped = unwrapExpression(node);
  return t.isTSInstantiationExpression(unwrapped)
    ? unwrapComponentExpression(unwrapped.expression)
    : unwrapped;
};

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

  const resolveFile = (fromFile: string, specifier: string): string | undefined => {
    try {
      return resolver.resolveFileSync(fromFile, specifier);
    } catch {
      return undefined;
    }
  };

  const resolveModule = (fromFile: string, specifier: string): ReferenceModule | undefined => {
    const filePath = resolveFile(fromFile, specifier);
    return filePath ? parseReferenceModule(filePath) : undefined;
  };

  const fromIdentifier = (module: ReferenceModule, localName: string): MetaComponentResolution => {
    const binding = findImport(module.program, localName);
    // A namespace object is not a class, so naming one as the component documents nothing.
    if (binding.kind === 'unsupported' || binding.kind === 'namespace') {
      return { reason: 'no-component-import' };
    }

    // A component declared in the module that names it is a real location, so reporting it lets a
    // caller explain why its docgen engine has no entry for it.
    if (binding.kind === 'local') {
      return { component: { localName, exportName: localName, path: module.filePath } };
    }

    const { importId, exportName } = binding;
    return {
      component: { localName, importId, exportName, path: resolveFile(module.filePath, importId) },
    };
  };

  return function resolveMetaComponent(csf: CsfFile, storyPath: string): MetaComponentResolution {
    // `_meta.component` is printed source text, so only the parsed node shows whether the value is
    // a name this pass can follow.
    const node = csf._metaAnnotations.component;
    if (!node) {
      return { reason: 'no-meta-component' };
    }

    const storyModule: ReferenceModule = { program: csf._file.path, filePath: storyPath };
    const expression = unwrapComponentExpression(node);
    if (t.isIdentifier(expression)) {
      return fromIdentifier(storyModule, expression.name);
    }

    // `ns.Button`, where `ns` is a namespace import, is `import { Button } from …` written another
    // way, so it resolves the same.
    if (
      t.isMemberExpression(expression) &&
      !expression.computed &&
      t.isIdentifier(expression.object) &&
      t.isIdentifier(expression.property)
    ) {
      const namespace = findImport(csf._file.path, expression.object.name);
      if (namespace.kind === 'namespace') {
        const exportName = expression.property.name;
        return {
          component: {
            localName: exportName,
            importId: namespace.importId,
            exportName,
            path: resolveFile(storyPath, namespace.importId),
          },
        };
      }
    }

    // A deeper property access (a shape another module owns, or a shared config object) is
    // followed to the name it lands on, which is then read in the module that binds it.
    const referenced = resolveReferencedValue(
      {
        ...storyModule,
        resolveModule,
        externalize: (n: t.Node) => (isSelfContained(n) ? n : undefined),
      },
      expression
    );
    if (referenced) {
      const value = unwrapComponentExpression(referenced.node);
      if (t.isIdentifier(value)) {
        return fromIdentifier(referenced.ctx, value.name);
      }
    }

    return { reason: 'unreadable-component-expression', expression: sourceOf(node) };
  };
}

type ImportBinding =
  | { kind: 'import'; importId: string; exportName: string }
  | { kind: 'namespace'; importId: string }
  | { kind: 'local' }
  | { kind: 'unsupported' };

function findImport(program: NodePath<t.Program>, localName: string): ImportBinding {
  for (const statement of program.get('body')) {
    if (!statement.isImportDeclaration()) {
      continue;
    }

    for (const specifier of statement.node.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }

      // A type-only import binds nothing documentable, but the name is still imported rather than
      // declared here.
      if (statement.node.importKind === 'type') {
        return { kind: 'unsupported' };
      }

      const importId = statement.node.source.value;
      if (t.isImportNamespaceSpecifier(specifier)) {
        return { kind: 'namespace', importId };
      }
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
