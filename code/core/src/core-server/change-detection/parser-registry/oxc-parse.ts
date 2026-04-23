import { parse as oxcRawParse } from 'oxc-parser';

import { logger } from 'storybook/internal/node-logger';

import { ChangeDetectionFailureError } from '../errors.ts';
import type { ImportEdge } from './types.ts';

/**
 * Extracts literal-string import edges from a JS/TS/JSX/TSX source file using oxc-parser.
 *
 * Skipped:
 *
 * - Type-only `import` / `export` declarations
 * - Dynamic imports with non-literal specifiers
 *
 * Caller is responsible for filtering CSS/asset specifiers from the returned list
 * (extension-based) — this function returns ALL literal-string specifiers it finds.
 *
 * Throws {@link ChangeDetectionFailureError} if the parser fails to produce any usable
 * result; callers should catch and treat such files as opaque-leaf nodes.
 */
export async function oxcParse(filePath: string, source: string): Promise<ImportEdge[]> {
  let parseResult: Awaited<ReturnType<typeof oxcRawParse>>;
  try {
    parseResult = await oxcRawParse(filePath, source);
  } catch (error) {
    throw new ChangeDetectionFailureError(
      `oxc-parser failed for ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      error instanceof Error ? { cause: error } : undefined
    );
  }

  const moduleInfo = parseResult.module;
  if (!moduleInfo) {
    throw new ChangeDetectionFailureError(`oxc-parser returned no module info for ${filePath}`);
  }

  const edges: ImportEdge[] = [];
  const seen = new Set<string>();

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
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    edges.push({ specifier, kind: 'static' });
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
      edges.push({ specifier, kind: 'static' });
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
    edges.push({ specifier: literal, kind: 'dynamic' });
  }

  // oxc-parser's `EcmaScriptModule` does not surface `require()` calls separately,
  // so walk the AST body to find them. The walk is expensive (visits every own-property
  // of every AST node), and on modern code `require(` is extremely rare — it is
  // syntactically impossible in `.mjs`/`.mts` and uncommon in `.ts`/`.tsx`. Two cheap
  // gates before paying the recursive walk:
  //   1. Extension-only skip for `.mjs`/`.mts` — ESM-exclusive file modes.
  //   2. Source-level substring prefilter for everything else — if the literal token
  //      `require(` never appears in the source, there is no CommonJS edge to find.
  // Both gates preserve the edge-set exactly: a `require(` call MUST include the token
  // `require(` verbatim in the source text.
  if (parseResult.program?.body && canContainRequireCall(filePath, source)) {
    collectRequireSpecifiers(parseResult.program, edges, seen);
  }

  return edges;
}

function canContainRequireCall(filePath: string, source: string): boolean {
  // Match the last extension segment without a toLowerCase allocation: `.tsx` / `.mjs`
  // comparisons are case-sensitive in practice on every platform we support here.
  const dot = filePath.lastIndexOf('.');
  if (dot !== -1) {
    const ext = filePath.slice(dot);
    if (ext === '.mjs' || ext === '.mts' || ext === '.MJS' || ext === '.MTS') {
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
 * Walks an oxc AST recursively looking for `CallExpression` nodes whose callee is
 * the identifier `require` and whose first argument is a string literal. The walk
 * is intentionally generic — it does not know oxc node shapes — so it visits every
 * own-property of every node and recurses into objects/arrays.
 */
function collectRequireSpecifiers(node: unknown, edges: ImportEdge[], seen: Set<string>): void {
  if (node === null || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      collectRequireSpecifiers(child, edges, seen);
    }
    return;
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
          edges.push({ specifier, kind: 'require' });
        }
      }
    }
  }

  for (const key of Object.keys(node)) {
    // Skip the parent backref, range/loc, and other non-AST metadata to avoid
    // walking into giant numeric arrays.
    if (key === 'parent' || key === 'loc' || key === 'range' || key === 'span') {
      continue;
    }
    try {
      collectRequireSpecifiers((node as Record<string, unknown>)[key], edges, seen);
    } catch (error) {
      // Some AST node properties are getters that may throw on access; ignore.
      logger.debug(`oxc-parse: skipped property '${key}' during require walk: ${String(error)}`);
    }
  }
}
