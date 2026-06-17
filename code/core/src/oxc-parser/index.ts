import { parse as oxcRawParse } from 'oxc-parser';

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
  let parseResult: Awaited<ReturnType<typeof oxcRawParse>>;
  try {
    parseResult = await oxcRawParse(filePath, source);
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
function collectDeclaredNames(declaration: unknown, names: Set<string>): void {
  const node = declaration as { type?: string; id?: { name?: string }; declarations?: unknown[] };
  if (node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') {
    if (node.id?.name) {
      names.add(node.id.name);
    }
    return;
  }
  if (node.type === 'VariableDeclaration' && Array.isArray(node.declarations)) {
    for (const declarator of node.declarations) {
      const id = (declarator as { id?: { type?: string; name?: string } }).id;
      // Only simple identifier bindings are referenceable by name (skip destructuring patterns).
      if (id?.type === 'Identifier' && id.name) {
        names.add(id.name);
      }
    }
  }
}

/**
 * Names declared locally in this module — top-level `var`/`let`/`const`, function and class
 * declarations, including those introduced via `export <declaration>`. Imports and re-exports
 * (`export { X } from '...'`, `export * from '...'`) are excluded because their bindings live in
 * another module and are not referenceable identifiers here.
 *
 * Used by the Vue docgen plugin to decide whether a generated `.__docgenInfo` assignment can
 * safely target a name without producing a reference to an undefined binding.
 */
export async function parseLocalBindings(filePath: string, source: string): Promise<Set<string>> {
  let parseResult: Awaited<ReturnType<typeof oxcRawParse>>;
  try {
    parseResult = await oxcRawParse(filePath, source);
  } catch {
    return new Set();
  }
  const body = parseResult.program?.body;
  if (!Array.isArray(body)) {
    return new Set();
  }

  const names = new Set<string>();

  for (const statement of body) {
    const node = statement as { type?: string; declaration?: unknown; source?: unknown };
    if (
      node.type === 'VariableDeclaration' ||
      node.type === 'FunctionDeclaration' ||
      node.type === 'ClassDeclaration'
    ) {
      collectDeclaredNames(node, names);
    } else if (node.type === 'ExportNamedDeclaration' && node.declaration && !node.source) {
      // `export const X` / `export function X` / `export class X` — a local declaration.
      // Specifier-only (`export { X }`) and re-exports (with a `source`) introduce no binding here.
      collectDeclaredNames(node.declaration, names);
    }
  }

  return names;
}

export async function parseReExports(
  filePath: string,
  source: string
): Promise<Map<string, ReExportEntry>> {
  let parseResult: Awaited<ReturnType<typeof oxcRawParse>>;
  try {
    parseResult = await oxcRawParse(filePath, source);
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
