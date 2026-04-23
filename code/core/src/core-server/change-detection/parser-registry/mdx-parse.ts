import type { ImportEdge } from './types.ts';

/**
 * Matches top-of-file `import` declarations in an MDX source. oxc-parser does not
 * understand MDX, so we fall back to a regex. This only captures literal-string
 * specifiers — enough for change detection to resolve them with oxc-resolver.
 */
const MDX_IMPORT_REGEX = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;

/** Extracts literal-string import edges from an `.mdx` file via regex fallback. */
export function mdxParse(source: string): ImportEdge[] {
  const edges: ImportEdge[] = [];
  const seen = new Set<string>();
  MDX_IMPORT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = MDX_IMPORT_REGEX.exec(source);
  while (match !== null) {
    const specifier = match[1];
    const key = `static:${specifier}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ specifier, kind: 'static' });
    }
    match = MDX_IMPORT_REGEX.exec(source);
  }
  return edges;
}
