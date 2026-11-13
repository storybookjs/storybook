import type { CsfFile } from 'storybook/internal/csf-tools';

import { type Node, unwrapExpression } from '../../csf-tools/estree/ast.ts';
import { parseReferenceModule } from '../../csf-tools/story-shape/reference-context.ts';
import { isSelfContained } from '../../csf-tools/story-shape/resolve-arg-value.ts';
import {
  type ReferenceModule,
  resolveReferencedValue,
  oneLineTextOf,
} from '../../csf-tools/story-shape/resolve-members.ts';
import { jsTsSourceExtensions } from '../../shared/constants/extensions.ts';
import { findImport, followBinding, resolveFileOrUndefined } from './follow-export.ts';
import { type ModuleResolver, createModuleResolver } from './module-resolver.ts';

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

export type MetaComponentResolverOptions =
  | {
      /** Extensions tried ahead of the JS/TS set, for single-file-component formats like `.vue`. */
      extensions?: string[];
      resolver?: never;
    }
  | {
      /**
       * Resolves import specifiers in place of the default resolver, for a renderer whose packages
       * need their own conditions or extension aliases.
       */
      resolver: ModuleResolver;
      extensions?: never;
    };

/** Peels the type-level wrappers off a component expression, as in `Comp<Props>` or `Comp as any`. */
const unwrapComponentExpression = (node: Node): Node => {
  const unwrapped = unwrapExpression(node);
  return unwrapped.type === 'TSInstantiationExpression'
    ? unwrapComponentExpression(unwrapped.expression)
    : unwrapped;
};

/**
 * Builds a resolver that locates the component behind `meta.component` in a parsed CSF file.
 *
 * Server-side docgen never loads the story module, so the exported name and declaring file have to
 * be recovered from source; the resolver caches, so create one per host rather than per call.
 *
 * Passing `componentNode` resolves a different declared expression — a CSF `subcomponents` entry —
 * through the same import, namespace, and reference following; the default stays the meta's own
 * component annotation.
 */
export function createMetaComponentResolver(options: MetaComponentResolverOptions = {}) {
  const resolver =
    options.resolver ??
    createModuleResolver({
      extensions: [...(options.extensions ?? []), ...jsTsSourceExtensions],
      // TypeScript's ESM resolution imports `./ui.ts` as `./ui.js`.
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.jsx': ['.tsx', '.jsx'],
        '.mjs': ['.mts', '.mjs'],
        '.cjs': ['.cts', '.cjs'],
      },
      mainFields: ['module', 'main'],
      tsconfig: 'auto',
    });

  const resolveFile = (fromFile: string, specifier: string) =>
    resolveFileOrUndefined(resolver, fromFile, specifier);
  const resolveModule = (fromFile: string, specifier: string) =>
    resolveReferenceModule(resolver, fromFile, specifier);

  const fromIdentifier = (module: ReferenceModule, localName: string): MetaComponentResolution => {
    const binding = findImport(module.editor.program, localName);
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

  return function resolveMetaComponent(
    csf: CsfFile,
    storyPath: string,
    componentNode?: Node
  ): MetaComponentResolution {
    // The component is printed source text, so only the parsed node shows whether the value is a
    // name this pass can follow.
    const node = componentNode ?? csf._metaAnnotations.component;
    if (!node) {
      return { reason: 'no-meta-component' };
    }

    const storyModule: ReferenceModule = { editor: csf.editor, filePath: storyPath };
    const expression = unwrapComponentExpression(node);
    if (expression.type === 'Identifier') {
      return fromIdentifier(storyModule, expression.name);
    }

    // `ns.Button`, where `ns` is a namespace, is `import { Button } from …` written another way, so it
    // resolves the same. The namespace can also come from a barrel, as in `export * as ns from …`.
    if (
      expression.type === 'MemberExpression' &&
      !expression.computed &&
      expression.object.type === 'Identifier' &&
      expression.property.type === 'Identifier'
    ) {
      const origin = followBinding({ resolver }, storyModule, expression.object.name);
      if (origin?.kind === 'namespace') {
        const exportName = expression.property.name;
        const { importId, path } = origin;
        return { component: { localName: exportName, exportName, importId, path } };
      }
    }

    // A deeper property access (a shape another module owns, or a shared config object) is
    // followed to the name it lands on, which is then read in the module that binds it.
    const referenced = resolveReferencedValue(
      {
        ...storyModule,
        resolveModule,
        externalize: (n: Node) => (isSelfContained(n) ? n : undefined),
      },
      expression
    );
    if (referenced) {
      const value = unwrapComponentExpression(referenced.node);
      if (value.type === 'Identifier') {
        return fromIdentifier(referenced.ctx, value.name);
      }
    }

    return { reason: 'unreadable-component-expression', expression: oneLineTextOf(node) };
  };
}

function resolveReferenceModule(
  resolver: ModuleResolver,
  fromFile: string,
  specifier: string
): ReferenceModule | undefined {
  const filePath = resolveFileOrUndefined(resolver, fromFile, specifier);
  return filePath ? parseReferenceModule(filePath) : undefined;
}
