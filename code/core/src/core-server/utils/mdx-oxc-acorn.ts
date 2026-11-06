import type { Options as MdxExpressionOptions } from 'micromark-extension-mdx-expression';
import { type OxcError, parseSync } from 'oxc-parser';

import { children } from '../../csf-tools/estree/ast.ts';

type Node = { type: string; start: number; end: number; [key: string]: unknown };

type Comment = { start: number; end: number };

type AcornOptions = { onComment?: unknown };

const oxcOptions = {
  lang: 'jsx',
  sourceType: 'module',
  preserveParens: true,
  showSemanticErrors: true,
} as const;

const childNodes = (node: Node) => children(node as never) as unknown as Node[];

// Acorn ends its messages with the position, which `micromark-util-events-to-acorn` strips.
// `raisedAt` at the end of the input lets an ESM block continue past a blank line. oxc reports some
// errors that more lines could fix before the end, so every error claims the end: more lines
// cannot fix the others, and they are thrown, at the same place, when the document ends.
const createError = (message: string, input: string, pos: number) => {
  const lines = input.slice(0, pos).split(/\r\n|[\n\r\u2028\u2029]/);
  const loc = { line: lines.length, column: lines[lines.length - 1].length };
  const error = new SyntaxError(`${message} (${loc.line}:${loc.column})`);
  return Object.assign(error, { pos, raisedAt: input.length, loc });
};

const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n\r\u2028\u2029]*/g, ' ');

const decodeGroupName = (name: string) =>
  name.replace(/\\u\{([\dA-Fa-f]+)\}|\\u([\dA-Fa-f]{4})/g, (_, braced, plain) =>
    String.fromCodePoint(parseInt(braced ?? plain, 16))
  );

// Node.js also accepts the ES2025 pattern modifiers and duplicate named groups.
const isValidEs2024RegExp = (pattern: string, flags: string) => {
  try {
    new RegExp(pattern, flags);
  } catch {
    return false;
  }
  const names = new Set<string>();
  let inClass = false;
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === '\\') {
      index += 1;
    } else if (inClass) {
      inClass = char !== ']';
    } else if (char === '[') {
      inClass = true;
    } else if (char === '(' && pattern[index + 1] === '?') {
      const next = pattern[index + 2];
      if (next === '<' && pattern[index + 3] !== '=' && pattern[index + 3] !== '!') {
        const name = decodeGroupName(pattern.slice(index + 3, pattern.indexOf('>', index + 3)));
        if (names.has(name)) {
          return false;
        }
        names.add(name);
      } else if (next !== ':' && next !== '=' && next !== '!' && next !== '<') {
        return false;
      }
    }
  }
  return true;
};

// Syntax oxc parses and acorn with acorn-jsx, in the ES2024 mode the MDX extensions use, rejects.
const isUnsupported = (node: Node, source: string) => {
  const after = (child: Node) => withoutComments(source.slice(child.end, node.end));
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
      return (
        !!node.phase || (!!node.source && /\b(?:with|assert)\b/.test(after(node.source as Node)))
      );
    case 'ImportExpression':
      return !!node.phase || !!node.options || after(node.source as Node).includes(',');
    case 'VariableDeclaration':
      return node.kind === 'using' || node.kind === 'await using';
    case 'Decorator':
    case 'AccessorProperty':
    case 'JSXSpreadChild':
      return true;
    case 'JSXSpreadAttribute':
      return (node.argument as Node).type === 'SequenceExpression';
    case 'JSXIdentifier':
      return /[\\\u{10000}-\u{10FFFF}]/u.test(source.slice(node.start, node.end));
    case 'AwaitExpression': {
      const { type } = node.argument as Node;
      return type === 'JSXElement' || type === 'JSXFragment';
    }
    case 'Literal': {
      const regex = node.regex as { pattern: string; flags: string } | undefined;
      return !!regex && !isValidEs2024RegExp(regex.pattern, regex.flags);
    }
    default:
      return false;
  }
};

const findUnsupported = (node: Node, source: string): Node | undefined => {
  if (isUnsupported(node, source)) {
    return node;
  }
  for (const child of childNodes(node)) {
    const found = findUnsupported(child, source);
    if (found) {
      return found;
    }
  }
  return undefined;
};

const shift = (node: Node, offset: number) => {
  node.start -= offset;
  node.end -= offset;
  for (const child of childNodes(node)) {
    shift(child, offset);
  }
};

const firstError = (source: string): OxcError | undefined =>
  parseSync('mdx.jsx', source, oxcOptions).errors.find((error) => error.severity === 'Error');

// oxc skips U+0085 and U+200B as whitespace. Acorn rejects them outside strings, comments and JSX
// text, as oxc does U+2060.
const findForeignWhitespace = (source: string) =>
  /[\u0085\u200b]/.test(source)
    ? firstError(source.replace(/[\u0085\u200b]/g, '\u2060'))
    : undefined;

// Acorn-jsx reads `<` right after an import or export source as less-than, so JSX on the next line
// is an error there, not a statement.
const findLessThanAfterSource = (program: Node, source: string) => {
  const body = program.body as Node[];
  return body.find((statement, index) => {
    const previous = body[index - 1] as Node | undefined;
    const from = previous?.source as Node | undefined;
    return source[statement.start] === '<' && !!from && from.end === previous!.end;
  });
};

// `offset` is the length of a prefix added to `source`; positions are reported without it.
const parseWithOxc = (source: string, offset: number) => {
  const result = parseSync('mdx.jsx', source, oxcOptions);
  const input = source.slice(offset);
  const toPosition = (start: number) => Math.min(Math.max(start - offset, 0), input.length);
  const error =
    result.errors.find((diagnostic) => diagnostic.severity === 'Error') ??
    findForeignWhitespace(source);
  if (error) {
    throw createError(error.message, input, toPosition(error.labels[0]?.start ?? source.length));
  }
  const program = result.program as unknown as Node;
  const unsupported = findLessThanAfterSource(program, source) ?? findUnsupported(program, source);
  if (unsupported) {
    throw createError('Unexpected token', input, toPosition(unsupported.start));
  }
  return { program, comments: result.comments as Comment[] };
};

const reportComments = (options: AcornOptions | undefined, comments: Comment[]) => {
  if (Array.isArray(options?.onComment)) {
    options.onComment.push(...comments);
  }
};

// Acorn with acorn-jsx, as the micromark MDX extensions use it, parsing with oxc-parser.
export const oxcAcorn = {
  parse(input: string, options?: AcornOptions) {
    const { program, comments } = parseWithOxc(input, 0);
    reportComments(options, comments);
    return program;
  },

  // The extensions always pass 0 as the position.
  parseExpressionAt(input: string, _position: number, options?: AcornOptions) {
    // Acorn skips a leading hashbang. The line ending ends a trailing line comment.
    const code = input.replace(/^#![^\n\r\u2028\u2029]*/, (hashbang) =>
      ' '.repeat(hashbang.length)
    );
    const source = `(${code}\n)`;
    const { program, comments } = parseWithOxc(source, 1);
    // The added parenthesis is the outermost node at 0. When `a), (b` closes it early, acorn also
    // stops after `a`, and the extensions reject the rest.
    let parenthesized: Node | undefined = (program.body as Node[])[0];
    while (parenthesized && parenthesized.type !== 'ParenthesizedExpression') {
      parenthesized = childNodes(parenthesized).find((child) => child.start === 0);
    }
    if (!parenthesized) {
      throw createError('Unexpected token', input, 0);
    }
    const expression = parenthesized.expression as Node;
    shift(expression, 1);
    for (const comment of comments) {
      comment.start -= 1;
      comment.end -= 1;
    }
    reportComments(options, comments);
    return expression;
  },
} as unknown as NonNullable<MdxExpressionOptions['acorn']>;
