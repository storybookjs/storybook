import {
  type FormattingOptions,
  type ModificationOptions,
  type ParseError,
  applyEdits,
  findNodeAtLocation,
  modify,
  parse,
  parseTree,
  printParseErrorCode,
} from 'jsonc-parser';

/** A path into a JSON document, e.g. `['projects', 'app', 'architect', 'storybook', 'builder']`. */
export type JSONEditPath = (string | number)[];

const DEFAULT_INDENTATION: FormattingOptions = { insertSpaces: true, tabSize: 2 };

// `jsonc-parser` re-indents the lines it touches, so a wrong tab size leaves the document with
// mixed indentation. Read it from the first top-level property that starts its own line, because
// the first indented line in the file could be part of a comment.
const detectIndentation = (text: string): FormattingOptions => {
  const properties = parseTree(text, [], { allowTrailingComma: true })?.children ?? [];
  for (const { offset } of properties) {
    const indent = text.slice(text.lastIndexOf('\n', offset) + 1, offset);
    if (/^(\t+| +)$/.test(indent)) {
      return indent.startsWith('\t')
        ? { insertSpaces: false, tabSize: 1 }
        : { insertSpaces: true, tabSize: indent.length };
    }
  }
  return DEFAULT_INDENTATION;
};

/**
 * Parse JSON that may contain comments and trailing commas, such as an Angular or Nx workspace
 * file or an `.eslintrc.json`.
 *
 * @throws When the text is not valid JSON with comments.
 */
export const parseJsonText = (text: string): unknown => {
  const errors: ParseError[] = [];
  // Editors on Windows may save a byte order mark. ESLint strips it too, where JSON.parse would throw
  const value = parse(text.replace(/^\uFEFF/, ''), errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const [{ error, offset }] = errors;
    throw new SyntaxError(`${printParseErrorCode(error)} at offset ${offset}`);
  }
  return value;
};

/**
 * Apply a format-preserving edit to a JSON string at `path`. `value === undefined` removes it.
 * Comments and the formatting outside the edited value are kept.
 */
export const editJsonText = (
  text: string,
  path: JSONEditPath,
  value: unknown,
  options: Pick<ModificationOptions, 'getInsertionIndex'> = {}
): string =>
  applyEdits(
    text,
    modify(text, path, value, { ...options, formattingOptions: detectIndentation(text) })
  );

// An optional comma, then `//` or one-line `/* */` comments up to the end of the line
const TRAILING_COMMENTS =
  /^([ \t]*,)?(?:[ \t]*(?:\/\/[^\r\n]*|\/\*(?:(?!\*\/)[^\r\n])*\*\/))+(?=[ \t]*(?:\r?\n|$))/;

/**
 * Append `value` to the array at `path`, keeping comments and formatting like `editJsonText`.
 * Comments that end the last item's line stay with that item, where jsonc-parser would hand them
 * to the new one.
 */
export const appendJsonArrayItem = (text: string, path: JSONEditPath, value: unknown): string => {
  const root = parseTree(text, [], { allowTrailingComma: true });
  const array = root && findNodeAtLocation(root, path);
  const last = array?.type === 'array' ? array.children?.at(-1) : undefined;
  const lineStart = last ? text.lastIndexOf('\n', last.offset) + 1 : -1;
  const lastEnd = last ? last.offset + last.length : -1;
  const trailingComments = last && TRAILING_COMMENTS.exec(text.slice(lastEnd));

  // On the `[` line, the line's indentation is not an item's, so let jsonc-parser format instead
  if (!array || !trailingComments || lineStart <= array.offset) {
    return editJsonText(text, [...path, -1], value);
  }

  const indent = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
  const [comments, trailingComma] = trailingComments;
  const commentsEnd = lastEnd + comments.length;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return [
    text.slice(0, lastEnd),
    trailingComma ? '' : ',',
    text.slice(lastEnd, commentsEnd),
    `${eol}${indent}${JSON.stringify(value)}`,
    trailingComma ? ',' : '',
    text.slice(commentsEnd),
  ].join('');
};
