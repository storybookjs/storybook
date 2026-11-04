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

// `jsonc-parser` re-indents the lines it touches, so a wrong tab size leaves the document with
// mixed indentation.
const detectIndentation = (text: string): FormattingOptions => {
  const indent = /^[ \t]+(?=[^\s])/m.exec(text)?.[0];

  if (!indent) {
    return { insertSpaces: true, tabSize: 2 };
  }

  return indent.startsWith('\t')
    ? { insertSpaces: false, tabSize: 1 }
    : { insertSpaces: true, tabSize: indent.length };
};

/**
 * Parse JSON that may contain comments and trailing commas, such as an Angular or Nx workspace
 * file or an `.eslintrc.json`.
 *
 * @throws When the text is not valid JSON with comments.
 */
export const parseJsonText = (text: string): unknown => {
  const errors: ParseError[] = [];
  const value = parse(text, errors, { allowTrailingComma: true });
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
  options: Pick<ModificationOptions, 'isArrayInsertion' | 'getInsertionIndex'> = {}
): string =>
  applyEdits(
    text,
    modify(text, path, value, { ...options, formattingOptions: detectIndentation(text) })
  );

/**
 * Append `value` to the array at `path`, keeping comments and formatting like `editJsonText`. A line
 * comment after the last item stays with that item, where jsonc-parser would hand it to the new one.
 */
export const appendJsonArrayItem = (text: string, path: JSONEditPath, value: unknown): string => {
  const root = parseTree(text, [], { allowTrailingComma: true });
  const last = (root && findNodeAtLocation(root, path))?.children?.at(-1);
  if (last) {
    const lineStart = text.lastIndexOf('\n', last.offset) + 1;
    const indent = /^[ \t]*/.exec(text.slice(lineStart))?.[0] ?? '';
    const lastEnd = last.offset + last.length;
    const trailingComment = /^([ \t]*,)?[ \t]*\/\/[^\r\n]*/.exec(text.slice(lastEnd));
    if (trailingComment && lineStart + indent.length === last.offset) {
      const [comment, trailingComma] = trailingComment;
      const commentEnd = lastEnd + comment.length;
      const eol = text.includes('\r\n') ? '\r\n' : '\n';
      return [
        text.slice(0, lastEnd),
        trailingComma ? '' : ',',
        text.slice(lastEnd, commentEnd),
        `${eol}${indent}${JSON.stringify(value)}`,
        trailingComma ? ',' : '',
        text.slice(commentEnd),
      ].join('');
    }
  }
  return editJsonText(text, [...path, -1], value, { isArrayInsertion: true });
};
