import type { ImportEdge } from './types.ts';

/**
 * Matches `import` or `export ... from` declarations in an MDX source.
 * oxc-parser does not understand MDX, so we fall back to a regex. This only captures
 * literal-string specifiers — enough for change detection to resolve them with oxc-resolver.
 */
const MDX_IMPORT_REGEX =
  /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+)['"]([^'"]+)['"]/g;

/**
 * Strips fenced code blocks (```lang\n...\n```) and inline code (`...`) from MDX source,
 * replacing each region with spaces of equal length. Preserves line numbers so any
 * future debug output remains accurate. We strip before running the import regex to avoid
 * treating example imports inside code blocks as real dependency edges.
 */
function stripCodeRegions(source: string): string {
  // Replace fenced code blocks first (they may contain backtick runs inside).
  // The `s` flag makes `.` match newlines so multi-line blocks are covered.
  let stripped = source.replace(/```[\s\S]*?```/gs, (match) => ' '.repeat(match.length));
  // Replace inline code spans (single backtick pairs).
  stripped = stripped.replace(/`[^`]*`/g, (match) => ' '.repeat(match.length));
  return stripped;
}

/** Extracts literal-string import edges from an `.mdx` file via regex fallback. */
export function mdxParse(source: string): ImportEdge[] {
  const stripped = stripCodeRegions(source);
  const edges: ImportEdge[] = [];
  const seen = new Set<string>();
  MDX_IMPORT_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = MDX_IMPORT_REGEX.exec(stripped);
  while (match !== null) {
    const specifier = match[1];
    const key = `static:${specifier}`;
    if (!seen.has(key)) {
      seen.add(key);
      edges.push({ specifier, kind: 'static', importedNames: null });
    }
    match = MDX_IMPORT_REGEX.exec(stripped);
  }
  return edges;
}
