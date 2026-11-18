// Source Line of Code computation metric.
import ts from 'typescript';

export const SOURCE_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs|css)$/;

const SCRIPT_EXTENSIONS = /\.(?:tsx?|jsx?|mjs|cjs)$/;
const CSS_EXTENSION = /\.css$/;
const CSS_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * `.tsx` and `.jsx` parse as JSX; `.ts` must not. Parsing a plain `.ts` file in
 * TSX mode makes a generic arrow function (`const f = <T>(x: T) => x`) read as
 * an unterminated JSX element. The ported walker had this bug; it is fixed here
 * and in cyclomatic.ts / cognitive.ts, which use the same rule.
 */
export function scriptKindFor(filename: string): ts.ScriptKind {
  if (filename.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (filename.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (filename.endsWith('.ts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

/**
 * Whether TypeScript reported syntax errors parsing this file.
 *
 * The parser is deliberately error-tolerant — `function ( { { {` recovers into
 * a malformed declaration rather than throwing — so "the walker found no
 * functions" is not a reliable failure signal. `parseDiagnostics` is, and it
 * stays empty for valid but unusual code such as a generic arrow in a `.ts`
 * file, which is exactly the case the ScriptKind choice exists to protect.
 *
 * Not part of the public typings, hence the cast.
 */
export function hasParseErrors(filename: string, source: string): boolean {
  try {
    const sourceFile = ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ false,
      scriptKindFor(filename)
    );
    const diagnostics = (sourceFile as unknown as { parseDiagnostics?: unknown[] })
      .parseDiagnostics;
    return Array.isArray(diagnostics) && diagnostics.length > 0;
  } catch {
    return true;
  }
}

/** Every comment in the file, as [start, end) offsets, deduplicated and sorted. */
function commentRanges(sourceFile: ts.SourceFile, text: string): Array<[number, number]> {
  const seen = new Map<number, number>();

  const record = (ranges: ts.CommentRange[] | undefined): void => {
    for (const range of ranges ?? []) {
      seen.set(range.pos, Math.max(seen.get(range.pos) ?? 0, range.end));
    }
  };

  const visit = (node: ts.Node): void => {
    // Both halves are needed. TypeScript classifies a comment sharing a line
    // with preceding code as *trailing* trivia, so `const a = 1 // why` is
    // invisible to getLeadingCommentRanges alone.
    record(ts.getLeadingCommentRanges(text, node.getFullStart()));
    record(ts.getTrailingCommentRanges(text, node.getEnd()));
    for (const child of node.getChildren(sourceFile)) visit(child);
  };

  visit(sourceFile);
  return [...seen.entries()].sort((a, b) => a[0] - b[0]);
}

/**
 * Drop blank lines and trailing whitespace. Trailing whitespace is stripped
 * because removing a trailing comment leaves a gap behind, and because
 * whitespace-only churn at line ends is not a source change worth counting.
 */
function dropBlankLines(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .join('\n');
}

export function stripToSloc(source: string, filename: string): string {
  if (CSS_EXTENSION.test(filename)) {
    return dropBlankLines(source.replace(CSS_BLOCK_COMMENT, ''));
  }

  if (!SCRIPT_EXTENSIONS.test(filename)) {
    return dropBlankLines(source);
  }

  let ranges: Array<[number, number]>;
  try {
    const sourceFile = ts.createSourceFile(
      filename,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      scriptKindFor(filename)
    );
    ranges = commentRanges(sourceFile, source);
  } catch {
    // A file the agent left syntactically broken is still diffable text; losing
    // comment stripping is far better than losing the file from the metric.
    return dropBlankLines(source);
  }

  // Remove back to front so earlier offsets stay valid. Newlines inside a
  // removed block are preserved so surrounding lines do not merge.
  let text = source;
  for (const [start, end] of [...ranges].reverse()) {
    const removed = text.slice(start, end);
    text = text.slice(0, start) + removed.replace(/[^\n]/g, '') + text.slice(end);
  }

  return dropBlankLines(text);
}

export function countSloc(source: string, filename: string): number {
  const stripped = stripToSloc(source, filename);
  return stripped === '' ? 0 : stripped.split('\n').length;
}
