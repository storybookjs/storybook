import type { Options as MdxExpressionOptions } from 'micromark-extension-mdx-expression';
import { parseSync } from 'oxc-parser';

/** The parser interface the micromark MDX extensions expect: acorn's `parse` and `parseExpressionAt`. */
export type AcornLike = NonNullable<MdxExpressionOptions['acorn']>;

/** The acorn options the micromark MDX extensions pass; only `onComment` is used here. */
type AcornLikeOptions = { onComment?: unknown };

type Node = { type: string; start: number; end: number; [key: string]: unknown };

type Comment = { type: 'Line' | 'Block'; value: string; start: number; end: number };

const childNodes = (node: Node): Node[] =>
  Object.values(node)
    .flat()
    .filter(
      (child): child is Node =>
        !!child && typeof child === 'object' && typeof (child as Node).type === 'string'
    );

/**
 * The fields of an acorn `SyntaxError` that `micromark-util-events-to-acorn` reads.
 *
 * `raisedAt` is where acorn's tokenizer stood when it gave up. When that is the end of the input,
 * the MDX ESM extension assumes a blank line ended the block too early and parses it again together
 * with the lines up to the next blank line, and only reports the error at the end of the document.
 * oxc does not report where it gave up as acorn does: it can, for example, report a missing arrow
 * function body at the arrow. So every error is reported as raised at the end. That can only change
 * when an error is thrown, not whether: an error that more lines cannot fix stays in the longer
 * block, at the same place, and an error they can fix is one acorn raised at the end as well.
 */
type AcornLikeError = SyntaxError & {
  pos: number;
  raisedAt: number;
  loc: { line: number; column: number };
};

const oxcOptions = {
  lang: 'jsx',
  sourceType: 'module',
  preserveParens: true,
  // Duplicate declarations, strict mode violations and similar early errors, which acorn reports too.
  showSemanticErrors: true,
} as const;

const createError = (message: string, input: string, pos: number): AcornLikeError => {
  const lines = input.slice(0, pos).split(/\r\n|[\n\r\u2028\u2029]/);
  const loc = { line: lines.length, column: lines[lines.length - 1].length };
  // Acorn appends the position to its messages; `micromark-util-events-to-acorn` strips it again.
  const error = new SyntaxError(`${message} (${loc.line}:${loc.column})`) as AcornLikeError;
  return Object.assign(error, { pos, raisedAt: input.length, loc });
};

// Strip comments before looking for syntax between two nodes.
const withoutComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n\r\u2028\u2029]*/g, ' ');

const decodeGroupName = (name: string) =>
  name.replace(/\\u\{([\dA-Fa-f]+)\}|\\u([\dA-Fa-f]{4})/g, (_, braced, plain) =>
    String.fromCodePoint(parseInt(braced ?? plain, 16))
  );

/**
 * Whether a regular expression is valid in ES2024: the engine must accept it, and it must not use
 * the ES2025 additions (pattern modifiers such as `(?i:a)` and duplicate named groups), which newer
 * Node.js versions accept.
 */
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
        const close = pattern.indexOf('>', index + 3);
        const name = decodeGroupName(pattern.slice(index + 3, close));
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

/**
 * Find syntax that oxc parses but acorn, configured for ES2024 like the MDX extensions do, rejects:
 * syntax from later editions and proposals, and invalid regular expressions, which oxc does not
 * validate.
 */
const findUnsupported = (node: Node, source: string): Node | undefined => {
  const after = (child: unknown) => withoutComments(source.slice((child as Node).end, node.end));
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
      // Import attributes (`with { type: 'json' }`) and the `defer` and `source` import phases.
      if (node.phase || (node.source && /\b(?:with|assert)\b/.test(after(node.source)))) {
        return node;
      }
      break;
    case 'ImportExpression':
      // The second `import()` argument, or a trailing comma, and import phases.
      if (node.phase || node.options || after(node.source).includes(',')) {
        return node;
      }
      break;
    case 'VariableDeclaration':
      if (node.kind === 'using' || node.kind === 'await using') {
        return node;
      }
      break;
    case 'Decorator':
    case 'AccessorProperty':
    // acorn-jsx does not support spread children (`<a>{...b}</a>`).
    case 'JSXSpreadChild':
      return node;
    case 'Literal': {
      const regex = node.regex as { pattern: string; flags: string } | undefined;
      if (regex && !isValidEs2024RegExp(regex.pattern, regex.flags)) {
        return node;
      }
      break;
    }
  }
  for (const child of childNodes(node)) {
    const found = findUnsupported(child, source);
    if (found) {
      return found;
    }
  }
  return undefined;
};

/** Move a node and its descendants `offset` code units to the left. */
const shift = (node: Node, offset: number) => {
  node.start -= offset;
  node.end -= offset;
  for (const child of childNodes(node)) {
    shift(child, offset);
  }
};

const reportComments = (options: AcornLikeOptions | undefined, comments: Comment[]) => {
  if (Array.isArray(options?.onComment)) {
    options.onComment.push(...comments);
  }
};

/**
 * Parse `source` with oxc. `offset` is the length of a prefix that `source` starts with but the
 * caller does not know about: positions in the result and in errors are relative to the rest.
 */
const parseWithOxc = (source: string, offset: number) => {
  const result = parseSync('mdx.jsx', source, oxcOptions);
  const input = source.slice(offset);
  const toPosition = (start: number) => Math.min(Math.max(start - offset, 0), input.length);
  const [error] = result.errors.filter((diagnostic) => diagnostic.severity === 'Error');
  if (error) {
    throw createError(error.message, input, toPosition(error.labels[0]?.start ?? source.length));
  }
  const program = result.program as unknown as Node;
  const unsupported = findUnsupported(program, source);
  if (unsupported) {
    throw createError('Unexpected token', input, toPosition(unsupported.start));
  }
  const comments = result.comments as Comment[];
  return { program, comments };
};

/**
 * A replacement for acorn extended with acorn-jsx, for the micromark MDX extensions, that parses
 * with oxc-parser. It accepts the same ES2024 module code with JSX and rejects the same code, so
 * MDX parses into the same tree, and it reports errors the way the extensions read them.
 */
export const oxcAcorn = {
  parse(input: string, options?: AcornLikeOptions) {
    const { program, comments } = parseWithOxc(input, 0);
    reportComments(options, comments);
    return program;
  },

  /**
   * Acorn parses the expression at the start of the input and stops after it; the MDX extensions
   * then check that only whitespace and comments follow. Wrapping the input in parentheses makes oxc
   * parse it as one expression, and the line ending lets a trailing line comment end before the
   * closing parenthesis.
   */
  // The extensions always parse from the start of the input, so `_position` is 0.
  parseExpressionAt(input: string, _position: number, options?: AcornLikeOptions) {
    // Acorn skips a hashbang at the start of its input, also when it parses an expression there.
    const code = input.replace(/^#![^\n\r\u2028\u2029]*/, (hashbang) =>
      ' '.repeat(hashbang.length)
    );
    const source = `(${code}\n)`;
    const { program, comments } = parseWithOxc(source, 1);
    // The added opening parenthesis is the outermost node that starts at 0. Code such as `a), (b`
    // closes it early: acorn then also stops after `a`, and the extensions report the rest. In
    // code such as `a) => (b` the parenthesis is no node of its own: acorn stops after `a` there
    // too, and the extensions report an error either way.
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
} as unknown as AcornLike;
