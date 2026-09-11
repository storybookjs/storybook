import type { StaticImportEntry } from 'oxc-parser';
import { parse as oxcRawParse } from 'oxc-parser';

import { OxcParseError } from './errors.ts';
import type { ImportEdge } from './types.ts';

/**
 * Files larger than this are treated as opaque-leaf and skipped — protects the require-walk
 * iterator (and the worker IPC roundtrip) from O(MB) AST traversals on minified bundles or
 * generated artefacts that happen to land in `code/`.
 */
const MAX_PARSE_SIZE = 2_000_000;

/**
 * Extracts literal-string import edges from a JS/TS/JSX/TSX source file using oxc-parser.
 * Type-only imports/exports and non-literal dynamic-import specifiers are skipped.
 * Throws {@link OxcParseError} when the parser fails or returns no module
 * info; callers should catch and treat such files as opaque-leaf.
 */
export async function oxcParse(filePath: string, source: string): Promise<ImportEdge[]> {
  if (source.length > MAX_PARSE_SIZE) {
    return [];
  }
  let parseResult: Awaited<ReturnType<typeof oxcRawParse>>;
  try {
    parseResult = await oxcRawParse(filePath, source);
  } catch (error) {
    throw new OxcParseError(
      `oxc-parser failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? { cause: error } : undefined
    );
  }

  const moduleInfo = parseResult.module;
  if (!moduleInfo) {
    throw new OxcParseError(`oxc-parser returned no module info for ${filePath}`);
  }

  const edges: ImportEdge[] = [];
  const seen = new Set<string>();
  // Tracks mutable edge objects for static imports so duplicates can merge names.
  const staticImportEdges = new Map<string, ImportEdge>();

  for (const staticImport of moduleInfo.staticImports) {
    const specifier = staticImport.moduleRequest.value;
    // A `StaticImport` represents `import ... from "mod"`. If every specifier
    // entry is `isType`, the whole import is type-only and contributes no
    // runtime edge. Bare `import "mod"` (entries empty) IS a runtime edge.
    const allTypeOnly =
      staticImport.entries.length > 0 && staticImport.entries.every((entry) => entry.isType);
    if (allTypeOnly) {
      continue;
    }
    const key = `static:${specifier}`;
    const newNames = extractImportedNames(staticImport.entries);
    const existing = staticImportEdges.get(key);
    if (existing) {
      // Merge: null (namespace/side-effect) wins; otherwise union the name sets.
      if (existing.importedNames !== null && newNames !== null) {
        for (const name of newNames) {
          existing.importedNames.add(name);
        }
      } else {
        existing.importedNames = null;
      }
    } else {
      const edge: ImportEdge = { specifier, kind: 'static', importedNames: newNames };
      staticImportEdges.set(key, edge);
      edges.push(edge);
      seen.add(key);
    }
  }

  for (const staticExport of moduleInfo.staticExports) {
    for (const entry of staticExport.entries) {
      if (!entry.moduleRequest || entry.isType) {
        continue;
      }
      const specifier = entry.moduleRequest.value;
      const key = `static:${specifier}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      // Export-derived edges carry null — they represent the barrel's own
      // dependency on its source modules, not a consumer-visible named import.
      edges.push({ specifier, kind: 'static', importedNames: null });
    }
  }

  for (const dynamicImport of moduleInfo.dynamicImports) {
    const specifierSpan = dynamicImport.moduleRequest;
    const literal = extractLiteralFromSource(source, specifierSpan.start, specifierSpan.end);
    if (literal === null) {
      continue;
    }
    const key = `dynamic:${literal}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    edges.push({ specifier: literal, kind: 'dynamic', importedNames: null });
  }

  // oxc-parser does not surface require() calls separately. Walk the AST only after two
  // cheap gates: ESM-exclusive extensions skip the walk entirely, and a source-level
  // substring prefilter rules out files that cannot contain the literal `require(` token.
  if (parseResult.program?.body && canContainRequireCall(filePath, source)) {
    collectRequireSpecifiers(parseResult.program, edges, seen);
  }

  return edges;
}

function canContainRequireCall(filePath: string, source: string): boolean {
  const dot = filePath.lastIndexOf('.');
  if (dot !== -1) {
    const ext = filePath.slice(dot).toLowerCase();
    if (ext === '.mjs' || ext === '.mts') {
      return false;
    }
  }
  return source.includes('require(');
}

/**
 * The dynamic-import `moduleRequest` span covers the literal token (including its
 * surrounding quotes) when the argument IS a string literal. If the argument is
 * non-literal (`import(someVar)`), the span still exists but does not delimit a
 * string literal we can use; we return null in that case so the caller skips it.
 */
function extractLiteralFromSource(source: string, start: number, end: number): string | null {
  if (start < 0 || end > source.length || end <= start) {
    return null;
  }
  const slice = source.slice(start, end);
  const first = slice[0];
  const last = slice[slice.length - 1];
  if ((first === '"' || first === "'" || first === '`') && last === first && slice.length >= 2) {
    const inner = slice.slice(1, -1);
    // Template literals with interpolation contain `${`; treat those as non-literal.
    if (first === '`' && inner.includes('${')) {
      return null;
    }
    return inner;
  }
  return null;
}

/**
 * Extracts the names imported from a static import's entry list.
 * Returns `null` for side-effect imports (empty entries), namespace imports (`* as ns`),
 * or when no runtime names can be determined; otherwise returns the array of names as
 * they appear in the source module (before any `as` rename).
 */
function extractImportedNames(entries: StaticImportEntry[]): Set<string> | null {
  if (entries.length === 0) {
    return null; // side-effect: import 'mod'
  }
  const names = new Set<string>();
  for (const entry of entries) {
    if (entry.isType) {
      continue;
    }
    const { kind, name } = entry.importName;
    if (kind === 'NamespaceObject') {
      return null; // import * as ns — cannot narrow
    }
    if (kind === 'Default') {
      names.add('default');
    } else if (kind === 'Name' && name) {
      names.add(name);
    }
  }
  return names.size > 0 ? names : null;
}

/**
 * Iterative AST walk for `CallExpression` nodes whose callee is the identifier `require`
 * and whose first argument is a string literal. Iterative (not recursive) so deeply
 * nested ASTs cannot blow the call stack on minified bundles. Skips estree-shaped
 * metadata fields (`parent`/`loc`/`range`); oxc-parser does not emit `parent`/`loc`/
 * `range`, so the skip is defensive against future shape changes.
 */
function collectRequireSpecifiers(root: unknown, edges: ImportEdge[], seen: Set<string>): void {
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || typeof node !== 'object') {
      continue;
    }
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) {
        stack.push(node[i]);
      }
      continue;
    }

    const maybeNode = node as { type?: unknown; callee?: unknown; arguments?: unknown };
    if (maybeNode.type === 'CallExpression') {
      const callee = maybeNode.callee as { type?: unknown; name?: unknown } | null | undefined;
      if (callee && callee.type === 'Identifier' && callee.name === 'require') {
        const args = Array.isArray(maybeNode.arguments) ? maybeNode.arguments : [];
        const firstArg = args[0] as { type?: unknown; value?: unknown } | null | undefined;
        if (
          firstArg &&
          (firstArg.type === 'StringLiteral' || firstArg.type === 'Literal') &&
          typeof firstArg.value === 'string'
        ) {
          const specifier = firstArg.value;
          const key = `require:${specifier}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({ specifier, kind: 'require', importedNames: null });
          }
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range') {
        continue;
      }
      stack.push((node as Record<string, unknown>)[key]);
    }
  }
}
