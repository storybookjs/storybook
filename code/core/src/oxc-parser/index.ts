import {
  parseSync as oxcRawParseSync,
  type Class,
  type Declaration,
  type Function,
  type VariableDeclaration,
} from 'oxc-parser';

import { oxcParse } from './parse.ts';
import type { ImportEdge, ReExportEntry } from './types.ts';
import { disposeOxcParsePool, getOxcParsePool } from './worker-pool.ts';

export type { ImportEdge, ReExportEntry } from './types.ts';

/**
 * Re-export map plus wildcard specifiers for a barrel file.
 * Named re-exports are keyed by their exported name.
 * Wildcard specifiers come from `export * from '...'` statements.
 */
export interface BarrelInfo {
  named: Map<string, ReExportEntry>;
  wildcards: string[];
}

/**
 * Parses a file with oxc-parser, using the worker pool when available and falling back to
 * inline {@link oxcParse} otherwise. Plugin parsers (Vue/Svelte/MDX) that use
 * `ctx.parseScriptWithOxc` also route through here, so SFC script blocks get the same
 * off-thread treatment as plain JS/TS files.
 */
export async function parseWithOxc(filePath: string, source: string): Promise<ImportEdge[]> {
  const pool = getOxcParsePool();
  if (!pool) {
    return oxcParse(filePath, source);
  }
  try {
    return await pool.parse(filePath, source);
  } catch {
    // Worker-level failure: fall back to inline so a single bad pool doesn't break the
    // whole build. The pool logs its own debug line; callers get the inline error if the
    // parse is genuinely malformed.
    return oxcParse(filePath, source);
  }
}

export { disposeOxcParsePool };

/**
 * Parses both named re-exports and wildcard re-export specifiers from a module.
 * Named re-exports are keyed by exported name; wildcard specifiers come from
 * `export * from '...'` and `export type * from '...'` statements. Used by the
 * barrel chain-follower so it can recurse through `export *` hops when a requested
 * name is not found as a direct named re-export.
 *
 * Type re-exports (`export type { Foo } from '...'`) are intentionally included:
 * consumers may import type-shaped names without the `type` keyword, and those
 * names still need to be chain-followed to their source files so the barrel itself
 * is not added as a fallback dep (which would cause false-positive change signals).
 */
export async function parseBarrelInfo(filePath: string, source: string): Promise<BarrelInfo> {
  let parseResult: Awaited<ReturnType<typeof oxcRawParseSync>>;
  try {
    parseResult = oxcRawParseSync(filePath, source);
  } catch {
    return { named: new Map(), wildcards: [] };
  }
  const moduleInfo = parseResult.module;
  if (!moduleInfo) {
    return { named: new Map(), wildcards: [] };
  }

  const named = new Map<string, ReExportEntry>();
  const wildcards: string[] = [];

  for (const staticExport of moduleInfo.staticExports) {
    for (const entry of staticExport.entries) {
      if (!entry.moduleRequest) {
        continue;
      }
      const specifier = entry.moduleRequest.value;
      if (entry.exportName.kind === 'None') {
        wildcards.push(specifier);
        continue;
      }
      const exportedName = entry.exportName.name;
      if (!exportedName) {
        continue;
      }
      if (entry.importName.kind !== 'Name' || !entry.importName.name) {
        continue;
      }
      named.set(exportedName, { specifier, importedName: entry.importName.name });
    }
  }

  return { named, wildcards };
}

/** Adds the binding name(s) introduced by a top-level declaration node to `names`. */
function collectDeclaredNames(
  node: VariableDeclaration | Class | Function | Declaration,
  names: Set<string>
): void {
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    if (node.id?.name) {
      names.add(node.id.name);
    }
    return;
  }
  if (node.type === 'VariableDeclaration' && Array.isArray(node.declarations)) {
    for (const declarator of node.declarations) {
      const { id } = declarator;
      // Only simple identifier bindings are referenceable by name (skip destructuring patterns).
      if (id?.type === 'Identifier' && id.name) {
        names.add(id.name);
      }
    }
  }
}

/** Bindings a module introduces into its own scope, split by how they got there. */
export interface ModuleBindings {
  /**
   * Names declared in this module: top-level `var`/`let`/`const`, function and class declarations,
   * including those introduced via `export <declaration>`.
   */
  declared: Set<string>;
  /**
   * Names bound by an `import`, mapped to the specifier they came from. These are referenceable
   * identifiers here even though the value lives in another module, so a property can be assigned
   * to them. Type-only imports are excluded because they leave no runtime binding.
   */
  imported: Map<string, string>;
}

/**
 * Bindings this module introduces into its own scope, whether declared locally or imported.
 * Re-exports (`export { X } from '...'`, `export * from '...'`) appear in neither set, since they
 * introduce no identifier here at all.
 *
 * Used by the Vue docgen plugin to decide whether a generated `.__docgenInfo` assignment can
 * safely target a name without producing a reference to an undefined binding.
 */
export async function parseModuleBindings(
  filePath: string,
  source: string
): Promise<ModuleBindings> {
  const declared = new Set<string>();
  const imported = new Map<string, string>();

  let parseResult: Awaited<ReturnType<typeof oxcRawParseSync>>;
  try {
    parseResult = oxcRawParseSync(filePath, source);
  } catch {
    return { declared, imported };
  }
  const body = parseResult.program?.body;
  if (!Array.isArray(body)) {
    return { declared, imported };
  }

  for (const statement of body) {
    const node = statement;
    if (
      node.type === 'VariableDeclaration' ||
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration'
    ) {
      collectDeclaredNames(node, declared);
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration && !node.source) {
      // `export const X` / `export function X` / `export class X` — a local declaration.
      // Specifier-only (`export { X }`) and re-exports (with a `source`) introduce no binding here.
      collectDeclaredNames(node.declaration, declared);
    } else if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
      for (const specifier of node.specifiers ?? []) {
        // `import { type X }` leaves no runtime binding, unlike the rest of the clause.
        if (specifier.type === 'ImportSpecifier' && specifier.importKind === 'type') {
          continue;
        }
        if (specifier.local?.name) {
          imported.set(specifier.local.name, node.source.value);
        }
      }
    }
  }

  return { declared, imported };
}

/**
 * Names declared locally in this module. See {@link parseModuleBindings} for imports, which are
 * also referenceable here.
 */
export async function parseLocalBindings(filePath: string, source: string): Promise<Set<string>> {
  const { declared } = await parseModuleBindings(filePath, source);
  return declared;
}

export async function parseReExports(
  filePath: string,
  source: string
): Promise<Map<string, ReExportEntry>> {
  let parseResult: Awaited<ReturnType<typeof oxcRawParseSync>>;
  try {
    parseResult = oxcRawParseSync(filePath, source);
  } catch {
    return new Map();
  }
  const moduleInfo = parseResult.module;
  if (!moduleInfo) {
    return new Map();
  }

  const map = new Map<string, ReExportEntry>();

  for (const staticExport of moduleInfo.staticExports) {
    for (const entry of staticExport.entries) {
      if (entry.isType || !entry.moduleRequest) {
        continue;
      }
      // export * from '...' has no exportName (kind === 'None') — skip wildcards.
      if (entry.exportName.kind === 'None') {
        continue;
      }
      const exportedName = entry.exportName.name;
      if (!exportedName) {
        continue;
      }
      const specifier = entry.moduleRequest.value;
      if (entry.importName.kind !== 'Name' || !entry.importName.name) {
        continue; // All / AllButDefault wildcards — skip
      }
      const importedName = entry.importName.name;
      map.set(exportedName, { specifier, importedName });
    }
  }

  return map;
}
