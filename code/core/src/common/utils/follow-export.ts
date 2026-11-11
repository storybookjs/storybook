import type { E, Node } from '../../csf-tools/estree/ast.ts';
import { parseReferenceModule } from '../../csf-tools/story-shape/reference-context.ts';
import type { ReferenceModule } from '../../csf-tools/story-shape/resolve-members.ts';
import type { ModuleResolver } from './module-resolver.ts';

/** Where a module export comes from, after its re-exports are followed. */
export type ExportOrigin =
  /** A module namespace, as after `export * as UI from './ui'`. */
  | { kind: 'namespace'; importId: string; path: string | undefined }
  /**
   * A binding that `filePath` declares under `localName`. An anonymous default export, or an export
   * that the reader says the file owns, has the local name of the export.
   */
  | { kind: 'declaration'; filePath: string; localName: string };

/** How `followExport` reads the modules it walks. */
export interface ExportReader {
  resolver: ModuleResolver;
  /** The JS a file exposes. The default parses the file as JS or TS. */
  readModule?: (filePath: string) => ReferenceModule | undefined;
  /** Whether a file owns an export that its JS does not write, as a `.svelte` file owns `default`. */
  ownsExport?: (filePath: string, exportName: string) => boolean;
}

/**
 * Follows the export `exportName` of the module at `filePath` through re-exports and imports, as a
 * barrel writes them, to the namespace or declaration it comes from. `undefined` when the export
 * cannot be followed.
 */
export function followExport(
  reader: ExportReader,
  filePath: string,
  exportName: string,
  seen = new Set<string>()
): ExportOrigin | undefined {
  if (reader.ownsExport?.(filePath, exportName)) {
    return { kind: 'declaration', filePath, localName: exportName };
  }
  // Two barrels can re-export each other with `export *`, which would never end.
  const key = `${filePath}#${exportName}`;
  if (seen.has(key)) {
    return undefined;
  }
  seen.add(key);

  const module = (reader.readModule ?? parseReferenceModule)(filePath);
  if (!module) {
    return undefined;
  }
  const forward = (specifier: string, name: string) => {
    const target = resolveFileOrUndefined(reader.resolver, filePath, specifier);
    return target ? followExport(reader, target, name, seen) : undefined;
  };

  // An explicit export wins over `export *` wherever it is written, so the stars are tried last.
  const stars: string[] = [];
  for (const statement of module.editor.program.body) {
    if (statement.type === 'ExportAllDeclaration' && statement.exportKind !== 'type') {
      const specifier = statement.source.value;
      if (!statement.exported) {
        stars.push(specifier);
      } else if (moduleExportName(statement.exported) === exportName) {
        return {
          kind: 'namespace',
          importId: specifier,
          path: resolveFileOrUndefined(reader.resolver, filePath, specifier),
        };
      }
      continue;
    }

    if (statement.type === 'ExportDefaultDeclaration' && exportName === 'default') {
      return statement.declaration.type === 'Identifier'
        ? followBinding(reader, module, statement.declaration.name, seen)
        : { kind: 'declaration', filePath, localName: exportName };
    }

    if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
      continue;
    }
    // A declared export also shadows any `export *` of the same name.
    if (statement.declaration && declares(module, statement.declaration, exportName)) {
      return { kind: 'declaration', filePath, localName: exportName };
    }
    const specifier = statement.specifiers.find(
      (candidate) =>
        candidate.exportKind !== 'type' && moduleExportName(candidate.exported) === exportName
    );
    if (!specifier) {
      continue;
    }
    const localName = moduleExportName(specifier.local);
    return statement.source
      ? forward(statement.source.value, localName)
      : followBinding(reader, module, localName, seen);
  }

  // `export *` forwards every name but `default`.
  if (exportName === 'default') {
    return undefined;
  }
  for (const specifier of stars) {
    const found = forward(specifier, exportName);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Follows the name `localName` binds in `module` to the namespace or declaration it comes from, as
 * `followExport` follows an export.
 */
export function followBinding(
  reader: ExportReader,
  module: ReferenceModule,
  localName: string,
  seen = new Set<string>()
): ExportOrigin | undefined {
  const binding = findImport(module.editor.program, localName);
  switch (binding.kind) {
    case 'namespace':
      return {
        kind: 'namespace',
        importId: binding.importId,
        path: resolveFileOrUndefined(reader.resolver, module.filePath, binding.importId),
      };
    case 'import': {
      const target = resolveFileOrUndefined(reader.resolver, module.filePath, binding.importId);
      return target ? followExport(reader, target, binding.exportName, seen) : undefined;
    }
    case 'local':
      return { kind: 'declaration', filePath: module.filePath, localName };
    case 'unsupported':
      return undefined;
    default: {
      const unhandled: never = binding;
      throw new Error(`Unhandled binding ${JSON.stringify(unhandled)}`);
    }
  }
}

export function resolveFileOrUndefined(
  resolver: ModuleResolver,
  fromFile: string,
  specifier: string
): string | undefined {
  try {
    return resolver.resolveFileSync(fromFile, specifier);
  } catch {
    return undefined;
  }
}

export type ImportBinding =
  | { kind: 'import'; importId: string; exportName: string }
  | { kind: 'namespace'; importId: string }
  | { kind: 'local' }
  | { kind: 'unsupported' };

export function findImport(program: E.Program, localName: string): ImportBinding {
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') {
      continue;
    }

    for (const specifier of statement.specifiers) {
      if (specifier.local.name !== localName) {
        continue;
      }

      // A type-only import binds nothing documentable, but the name is still imported rather than
      // declared here.
      if (statement.importKind === 'type') {
        return { kind: 'unsupported' };
      }

      const importId = statement.source.value;
      if (specifier.type === 'ImportNamespaceSpecifier') {
        return { kind: 'namespace', importId };
      }
      if (specifier.type === 'ImportDefaultSpecifier') {
        return { kind: 'import', importId, exportName: 'default' };
      }
      if (specifier.importKind === 'type') {
        return { kind: 'unsupported' };
      }
      return {
        kind: 'import',
        importId,
        exportName: moduleExportName(specifier.imported),
      };
    }
  }

  return { kind: 'local' };
}

function declares(module: ReferenceModule, declaration: Node, name: string): boolean {
  if (declaration.type === 'VariableDeclaration') {
    // A destructuring pattern can bind the name anywhere inside it, so the scope says where.
    const identifier = module.editor.scopes.program.bindings.get(name)?.identifier;
    return (
      !!identifier && identifier.start >= declaration.start && identifier.end <= declaration.end
    );
  }
  // Functions, classes, enums and TS namespaces name themselves in `id`.
  return (
    'id' in declaration && declaration.id?.type === 'Identifier' && declaration.id.name === name
  );
}

// A specifier can write the name as a string, as in `export { a as 'b' }`.
function moduleExportName(node: E.ModuleExportName): string {
  return node.type === 'Identifier' ? node.name : (node as E.StringLiteral).value;
}
