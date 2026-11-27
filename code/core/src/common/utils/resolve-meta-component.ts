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
import {
  type ExportReader,
  findImport,
  followBinding,
  followExport,
  resolveFileOrUndefined,
} from './follow-export.ts';
import { createModuleResolver } from './module-resolver.ts';

/** The component a story file documents, as far as static analysis can determine. */
export interface ResolvedMetaComponent {
  /** Local identifier the component is bound to, in the module that names it. */
  localName: string;
  /**
   * Specifier the component is imported from, as `importer` writes it, or `undefined` when the
   * component is declared in the module that names it. Use `path` for the file it resolves to.
   */
  importId?: string;
  /**
   * Module that writes `importId`. It is the story file for a plain import, but a barrel for a
   * namespace the barrel re-exports, so compare it before reading `importId` as the story's own.
   */
  importer?: string;
  /**
   * Declaring module, followed through re-exports, or the naming module itself; `undefined` when the
   * import does not resolve. When a module on the way cannot be read, the last module reached.
   */
  path?: string;
  /** Export name in `path`, so an import alias or a barrel's rename resolves to the real export. */
  exportName: string;
}

export type MetaComponentResolution =
  | { component: ResolvedMetaComponent }
  | { reason: 'no-meta-component' | 'no-component-import' }
  | {
      reason: 'unreadable-component-expression';
      /** Source text of the expression, so a caller can name what it could not follow. */
      expression: string;
    }
  | {
      /** The module the expression reads from has no export of that name. */
      reason: 'missing-export';
      expression: string;
      /** The specifier and export name that do not resolve to a declaration. */
      importId: string;
      exportName: string;
    };

export type MetaComponentResolverOptions =
  | {
      /** Extensions tried ahead of the JS/TS set, for single-file-component formats like `.vue`. */
      extensions?: string[];
      reader?: never;
    }
  | {
      /**
       * Resolves and reads modules in place of the defaults, for a renderer whose packages need
       * their own conditions or extension aliases, or whose modules are not plain JS or TS.
       */
      reader: ExportReader;
      extensions?: never;
    };

/**
 * The module resolver the component resolvers use by default: JS and TS sources, with `extensions`
 * tried first, and TypeScript's `.js` specifiers.
 */
function createSourceModuleResolver(extensions: string[] = []) {
  return createModuleResolver({
    extensions: [...extensions, ...jsTsSourceExtensions],
    extensionAlias: typescriptExtensionAlias,
    mainFields: ['module', 'main'],
    tsconfig: 'auto',
  });
}

/** TypeScript's ESM resolution imports `./ui.ts` as `./ui.js`. */
export const typescriptExtensionAlias: Record<string, string[]> = {
  '.js': ['.ts', '.tsx', '.js'],
  '.jsx': ['.tsx', '.jsx'],
  '.mjs': ['.mts', '.mjs'],
  '.cjs': ['.cts', '.cjs'],
};

/** Peels the type-level wrappers off a component expression, as in `Comp<Props>` or `Comp as any`. */
const unwrapComponentExpression = (node: Node): Node => {
  const unwrapped = unwrapExpression(node);
  return unwrapped.type === 'TSInstantiationExpression'
    ? unwrapComponentExpression(unwrapped.expression)
    : unwrapped;
};

/**
 * Builds a resolver that locates the component a node names, in the module that holds the node.
 *
 * Server-side docgen never loads the story module, so the exported name and declaring file have to
 * be recovered from source; the resolver caches, so create one per host rather than per call. The
 * node is usually a meta's `component` or one of its `subcomponents`, in a CSF file or in a Svelte
 * CSF module script.
 */
export function createComponentNodeResolver(options: MetaComponentResolverOptions = {}) {
  const reader: ExportReader = options.reader ?? {
    resolver: createSourceModuleResolver(options.extensions),
    // A single-file component, such as a `.vue` file, is the default export of its file.
    ownsExport: (filePath, exportName) =>
      exportName === 'default' && !!options.extensions?.some((ext) => filePath.endsWith(ext)),
  };
  const readModule = reader.readModule ?? parseReferenceModule;
  const resolveModule = (fromFile: string, specifier: string) => {
    const filePath = resolveFileOrUndefined(reader.resolver, fromFile, specifier);
    return filePath ? readModule(filePath) : undefined;
  };

  // An imported component is followed through re-exports to the file that declares it, so an engine
  // reads the component itself rather than a barrel that forwards it, and a name the module does not
  // export is reported rather than documented as whatever the barrel holds.
  const declared = (
    component: ResolvedMetaComponent,
    expression: string
  ): MetaComponentResolution => {
    const { importId, path, exportName } = component;
    if (!importId || !path) {
      return { component };
    }
    const origin = followExport(reader, path, exportName);
    switch (origin?.kind) {
      case 'declaration':
        return {
          component: { ...component, path: origin.filePath, exportName: origin.exportName },
        };
      case 'missing':
        return { reason: 'missing-export', expression, importId, exportName };
      // A namespace object is not a component, so naming one documents nothing.
      case 'namespace':
        return { reason: 'no-component-import' };
      case undefined:
        return { component };
      default: {
        const unhandled: never = origin;
        throw new Error(`Unhandled export origin ${JSON.stringify(unhandled)}`);
      }
    }
  };

  const fromIdentifier = (
    module: ReferenceModule,
    localName: string,
    expression: string
  ): MetaComponentResolution => {
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
    return declared(
      {
        localName,
        importId,
        importer: module.filePath,
        exportName,
        path: resolveFileOrUndefined(reader.resolver, module.filePath, importId),
      },
      expression
    );
  };

  return function resolveComponentNode(
    module: ReferenceModule,
    node: Node
  ): MetaComponentResolution {
    const expression = unwrapComponentExpression(node);
    const text = oneLineTextOf(node);
    if (expression.type === 'Identifier') {
      return fromIdentifier(module, expression.name, text);
    }

    // `ns.Button`, where `ns` is a namespace, is `import { Button } from …` written another way, so it
    // resolves the same. The namespace can also come from a barrel, as in `export * as ns from …`.
    if (
      expression.type === 'MemberExpression' &&
      !expression.computed &&
      expression.object.type === 'Identifier' &&
      expression.property.type === 'Identifier'
    ) {
      const origin = followBinding(reader, module, expression.object.name);
      if (origin?.kind === 'namespace') {
        const exportName = expression.property.name;
        const { importId, importer, path } = origin;
        return declared({ localName: exportName, exportName, importId, importer, path }, text);
      }
    }

    // A deeper property access (a shape another module owns, or a shared config object) is
    // followed to the name it lands on, which is then read in the module that binds it.
    const referenced = resolveReferencedValue(
      {
        ...module,
        resolveModule,
        externalize: (n: Node) => (isSelfContained(n) ? n : undefined),
      },
      expression
    );
    if (referenced) {
      const value = unwrapComponentExpression(referenced.node);
      if (value.type === 'Identifier') {
        return fromIdentifier(referenced.ctx, value.name, text);
      }
    }

    return { reason: 'unreadable-component-expression', expression: text };
  };
}

/**
 * Builds a resolver that locates the component behind `meta.component` in a parsed CSF file, or
 * behind `componentNode`, such as a CSF `subcomponents` entry, when it is passed. It reads the
 * file's meta and resolves the node like {@link createComponentNodeResolver}.
 */
export function createMetaComponentResolver(options: MetaComponentResolverOptions = {}) {
  const resolveComponentNode = createComponentNodeResolver(options);
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
    return resolveComponentNode({ editor: csf.editor, filePath: storyPath }, node);
  };
}
