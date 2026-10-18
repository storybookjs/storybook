import type * as E from 'oxc-parser';
import { parseSync, visitorKeys } from 'oxc-parser';

export type { E };

export type Node = E.Node;

export interface SourceLocation {
  start: { line: number; column: number; index: number };
  end: { line: number; column: number; index: number };
}

export interface ParsedModule {
  code: string;
  program: E.Program;
  comments: E.Comment[];
}

export class EstreeParseError extends SyntaxError {
  readonly fileName: string | undefined;

  readonly loc: SourceLocation | undefined;

  constructor(message: string, fileName: string | undefined, loc: SourceLocation | undefined) {
    super(
      loc
        ? `${message} (${loc.start.line}:${loc.start.column})${fileName ? ` in ${fileName}` : ''}`
        : message
    );
    this.name = 'EstreeParseError';
    this.fileName = fileName;
    this.loc = loc;
  }
}

type Lang = 'js' | 'jsx' | 'ts' | 'tsx';

const langFor = (fileName: string): Lang | undefined => {
  // A Vite id's `?query` or `#hash` is not part of the extension.
  const path = fileName.replace(/[?#].*$/, '');
  if (/\.[cm]?tsx?$/.test(path)) {
    return path.endsWith('x') ? 'tsx' : 'ts';
  }
  // JavaScript files may still contain JSX or type syntax, and TSX accepts both.
  return /\.[cm]?jsx?$/.test(path) ? 'tsx' : undefined;
};

type ParseAttempt = { module: ParsedModule } | { error: EstreeParseError; offset: number };

const labelStart = (diagnostic: E.OxcError) => diagnostic.labels?.[0]?.start;

const parseWith = (code: string, fileName: string | undefined, lang: Lang): ParseAttempt => {
  const name = fileName ?? `file.${lang}`;
  const options = {
    lang,
    sourceType: 'module',
    preserveParens: true,
    // Duplicate declarations and legacy octals are reported like Babel did, instead of parsing
    // into a program that silently keeps the last declaration.
    showSemanticErrors: true,
  } as const;
  const result = parseSync(name, code, options);
  const [error] = result.errors.filter((diagnostic) => diagnostic.severity === 'Error');
  if (error) {
    const offset = labelStart(error) ?? 0;
    return {
      error: new EstreeParseError(
        error.message,
        fileName,
        error.labels?.[0] ? locationOf(code, offset, offset) : undefined
      ),
      offset,
    };
  }
  return { module: { code, program: result.program, comments: result.comments } };
};

/** Replace CRLF and lone CR line endings with `\n`, as every parse does first. */
export const normalizeLineEndings = (code: string) => code.replace(/\r\n?/g, '\n');

/**
 * Give code one line ending, the one of `original`'s first line break: CRLF when that is one, as
 * Prettier's `endOfLine: 'auto'` decides, and `\n` otherwise.
 */
export const restoreLineEndings = (code: string, original: string) => {
  const lineBreak = original.indexOf('\n');
  const normalized = normalizeLineEndings(code);
  return lineBreak > 0 && original[lineBreak - 1] === '\r'
    ? normalized.replaceAll('\n', '\r\n')
    : normalized;
};

/**
 * Parse a module. Without a TS or JS file extension there is no grammar to pick: TSX accepts the
 * most, but rejects generic arrows and `<T>value` assertions that `.ts` allows, so TS is tried next
 * and the error of the parse that got further is reported.
 *
 * Line endings are normalized to `\n` first, so node offsets index the returned `code`, which can
 * be shorter than the code passed in. Lines and columns are the same in both.
 *
 * The tree has no parenthesized nodes: `outerSpan` gives the span of the parentheses around one.
 */
export const parseModule = (code: string, fileName?: string): ParsedModule => {
  const module = parseWithParentheses(code, fileName);
  normalize(module.program, undefined);
  return module;
};

// `parseModule`, but `textOf` can print every node of the tree and `moduleOf` finds its parse.
export const parsePrintable = (code: string, fileName?: string): ParsedModule => {
  const module = parseWithParentheses(code, fileName);
  normalize(module.program, module);
  return module;
};

const parseWithParentheses = (source: string, fileName: string | undefined): ParsedModule => {
  const code = normalizeLineEndings(source);
  const lang = fileName === undefined ? undefined : langFor(fileName);
  const attempt = lang ? parseWith(code, fileName, lang) : parseEither(code, fileName);
  if ('module' in attempt) {
    return attempt.module;
  }
  throw hasFlowPragma(code)
    ? new EstreeParseError(
        `Flow syntax is no longer supported, parse failed with: ${attempt.error.message}`,
        fileName,
        undefined
      )
    : attempt.error;
};

// The comments before the first statement: a license header, a docblock or `// @flow` lines.
const LEADING_COMMENTS = /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/))*/;

// Flow reads its pragma from any comment in the file's header, including `/** @flow */` docblocks.
const hasFlowPragma = (code: string) => /@flow\b/.test(LEADING_COMMENTS.exec(code)?.[0] ?? '');

const parseEither = (code: string, fileName: string | undefined): ParseAttempt => {
  const tsx = parseWith(code, fileName, 'tsx');
  if ('module' in tsx) {
    return tsx;
  }
  const ts = parseWith(code, fileName, 'ts');
  return 'module' in ts || ts.offset > tsx.offset ? ts : tsx;
};

const lineStartsCache = new Map<string, number[]>();

const lineStarts = (code: string) => {
  let starts = lineStartsCache.get(code);
  if (!starts) {
    starts = [0];
    for (let index = 0; index < code.length; index++) {
      if (code.charCodeAt(index) === 10) {
        starts.push(index + 1);
      }
    }
    // One entry: lookups repeat against the file being edited.
    lineStartsCache.clear();
    lineStartsCache.set(code, starts);
  }
  return starts;
};

const position = (code: string, index: number) => {
  const starts = lineStarts(code);
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (starts[middle] <= index) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return { line: low + 1, column: index - starts[low], index };
};

export const locationOf = (code: string, start: number, end: number): SourceLocation => ({
  start: position(code, start),
  end: position(code, end),
});

/** `file: (line:column)` and the offending line with a marker under `index`, as Babel printed it. */
export const codeFrame = (fileName: string | undefined, code: string, index: number) => {
  const { line, column } = locationOf(code, index, index).start;
  const text = code.split('\n')[line - 1] ?? '';
  const gutter = ' '.repeat(String(line).length);
  return `${fileName ? `${fileName}: ` : ''}(${line}:${column})\n> ${line} | ${text}\n  ${gutter} | ${' '.repeat(column)}^`;
};

export const isNode = (value: unknown): value is Node =>
  !!value && typeof value === 'object' && typeof (value as Node).type === 'string';

// Keys that hold type annotations rather than runtime code.
export const TYPE_KEYS = new Set([
  'typeAnnotation',
  'returnType',
  'typeParameters',
  'typeArguments',
  'superTypeArguments',
  'implements',
]);

/** A node's children with the key each was found under, in OXC's visitor order. */
export const childEntries = (
  node: Node,
  options: { skipTypes?: boolean } = {}
): { key: string; node: Node }[] => {
  const keys = (visitorKeys as Record<string, readonly string[]>)[node.type] ?? [];
  const result: { key: string; node: Node }[] = [];
  for (const key of keys) {
    if (options.skipTypes && TYPE_KEYS.has(key)) {
      continue;
    }
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          result.push({ key, node: item });
        }
      }
    } else if (isNode(value)) {
      result.push({ key, node: value });
    }
  }
  return result;
};

export const children = (node: Node, options?: { skipTypes?: boolean }): Node[] =>
  childEntries(node, options).map((entry) => entry.node);

/** Walk depth-first. Return `false` from `enter` to skip a node's children. */
export const walk = (
  node: Node,
  enter: (node: Node, parent: Node | null) => boolean | void,
  parent: Node | null = null
) => {
  if (enter(node, parent) === false) {
    return;
  }
  for (const child of children(node)) {
    walk(child, enter, node);
  }
};

export const isStringLiteral = (node: unknown): node is E.StringLiteral =>
  isNode(node) && node.type === 'Literal' && typeof (node as E.StringLiteral).value === 'string';

export const isNumericLiteral = (node: unknown): node is E.NumericLiteral =>
  isNode(node) && node.type === 'Literal' && typeof (node as E.NumericLiteral).value === 'number';

export const isBooleanLiteral = (node: unknown): node is E.BooleanLiteral =>
  isNode(node) && node.type === 'Literal' && typeof (node as E.BooleanLiteral).value === 'boolean';

export const isNullLiteral = (node: unknown): node is E.NullLiteral =>
  isNode(node) &&
  node.type === 'Literal' &&
  (node as E.NullLiteral).value === null &&
  !('regex' in node) &&
  !('bigint' in node);

export const isRegExpLiteral = (node: unknown): node is E.RegExpLiteral =>
  isNode(node) && node.type === 'Literal' && 'regex' in node && !!(node as E.RegExpLiteral).regex;

export const isIdentifier = (node: unknown, name?: string): node is E.IdentifierReference =>
  isNode(node) &&
  node.type === 'Identifier' &&
  (name === undefined || (node as E.IdentifierReference).name === name);

export const isFunction = (node: unknown): node is E.Function | E.ArrowFunctionExpression =>
  isNode(node) &&
  (node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression');

const WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
]);

/** Whether a node is a TS assertion, satisfies or non-null wrapper around an expression. */
export const isTSWrapper = (node: Node) => WRAPPERS.has(node.type);

/** Peel TS assertion/satisfies wrappers off an expression node. */
export const unwrapExpression = <T extends Node | null | undefined>(node: T): T => {
  let current: Node | null | undefined = node;
  while (current && isTSWrapper(current)) {
    current = (current as { expression: Node }).expression;
  }
  return current as T;
};

// Object literal properties written as `key: value`, methods or accessors (not spreads).
export type Property = E.ObjectProperty;

/**
 * Static key of an object member, or `undefined` for a spread or a key only running the code would
 * produce. A computed key written as a literal is static: `{ ['a']: 1 }` names `a`, `{ [a]: 1 }`
 * does not.
 */
export const staticKey = (member: Node): string | undefined => {
  if (member.type !== 'Property') {
    return undefined;
  }
  const key = member.key as Node;
  if (isStringLiteral(key)) {
    return key.value;
  }
  if (isNumericLiteral(key)) {
    return String(key.value);
  }
  if (key.type === 'Identifier' && !member.computed) {
    return key.name;
  }
  if (key.type === 'TemplateLiteral' && key.expressions.length === 0) {
    return key.quasis[0]?.value.cooked ?? key.quasis[0]?.value.raw;
  }
  return undefined;
};

export const objectProperty = (object: E.ObjectExpression, name: string): Property | undefined =>
  object.properties.find(
    (member): member is Property => member.type === 'Property' && staticKey(member) === name
  );

export type Span = { start: number; end: number };

export const sourceOf = (code: string, node: Span) => code.slice(node.start, node.end);

// The parse each node came from, so a node can be printed without its module.
const nodeModules = new WeakMap<object, ParsedModule>();

/** The parse a node of `parsePrintable` or `expressionFromSource` came from. */
export const moduleOf = (node: object): ParsedModule | undefined => nodeModules.get(node);

/** Mark `value` as derived from the nodes of `module`, so `moduleOf` finds that parse for it. */
export const derivedFrom = <T extends object>(value: T, module: ParsedModule): T => {
  nodeModules.set(value, module);
  return value;
};

const outerSpans = new WeakMap<object, Span>();

/** The span of a node with the parentheses written around it. */
export const outerSpan = (node: Span): Span => outerSpans.get(node) ?? node;

const isParenthesized = (node: Node): node is E.ParenthesizedExpression | E.TSParenthesizedType =>
  node.type === 'ParenthesizedExpression' || node.type === 'TSParenthesizedType';

// The node inside the parentheses around `node`, remembering the span of the outermost pair.
const withoutParentheses = (node: Node): Node => {
  let inner = node;
  while (isParenthesized(inner)) {
    inner = inner.type === 'ParenthesizedExpression' ? inner.expression : inner.typeAnnotation;
  }
  outerSpans.set(inner, { start: node.start, end: node.end });
  return inner;
};

const childKeys = new Map<string, readonly string[]>(Object.entries(visitorKeys));

// Replaces every parenthesized node under `root` by the node inside it, in one pass that also
// records the parse each node came from, if given. It keeps its own stack, so a deeply nested
// expression cannot overflow the call stack; tracking the size itself is faster than push and pop.
const normalize = (root: Node, module: ParsedModule | undefined) => {
  const stack = [root];
  let size = 1;
  while (size > 0) {
    const node = stack[--size];
    if (module !== undefined) {
      nodeModules.set(node, module);
    }
    const keys = childKeys.get(node.type);
    if (keys === undefined) {
      continue;
    }
    const fields = node as unknown as Record<string, Node | (Node | null)[] | null>;
    for (let index = 0; index < keys.length; index++) {
      const key = keys[index];
      const value = fields[key];
      if (Array.isArray(value)) {
        for (let position = 0; position < value.length; position++) {
          const item = value[position];
          if (item !== null && typeof item === 'object') {
            stack[size++] = isParenthesized(item)
              ? (value[position] = withoutParentheses(item))
              : item;
          }
        }
      } else if (value !== null && typeof value === 'object') {
        stack[size++] = isParenthesized(value) ? (fields[key] = withoutParentheses(value)) : value;
      }
    }
  }
};

// The text of each expression `expressionFromSource` returns: as written, and as it is placed.
const fragments = new WeakMap<object, { text: string; placeable: string }>();

const codeOf = (node: Node) => {
  const code = nodeModules.get(node)?.code;
  if (code === undefined) {
    throw new Error(
      `Cannot print a ${node.type} node whose source is unknown: expressions must come from \`get\`, \`transform\` or \`parseExpression\``
    );
  }
  return code;
};

/**
 * Source text of a node from `SourceEditor` or `expressionFromSource`, as written. Throws for any
 * other node, such as one from `parseModule`.
 */
export const textOf = (node: Node): string =>
  fragments.get(node)?.text ?? sourceOf(codeOf(node), node as Node & Span);

/**
 * `textOf` for placing a node as a value: a comma expression keeps its parentheses or gets them,
 * and a trailing line comment ends its line.
 */
export const placeableTextOf = (node: Node): string => {
  const fragment = fragments.get(node);
  if (fragment) {
    return fragment.placeable;
  }
  const code = codeOf(node);
  if (node.type !== 'SequenceExpression') {
    return sourceOf(code, node as Node & Span);
  }
  const outer = outerSpan(node);
  return outer === node ? `(${sourceOf(code, node)})` : sourceOf(code, outer);
};

/** Parse an expression fragment, which has no file name to pick its grammar. */
export const parseFragment = (code: string): ParsedModule => parseModule(code);

export const expressionFromSource = (source: string): E.Expression => {
  const code = normalizeLineEndings(source);
  // The line break ends a trailing line comment before the closing parenthesis.
  const wrapped = `(${code}\n)`;
  const module = parseWithParentheses(wrapped, undefined);
  const { program, comments } = module;
  const statement = program.body[0] as E.Statement | undefined;
  const wrapper = statement?.type === 'ExpressionStatement' ? statement.expression : undefined;
  if (wrapper?.type !== 'ParenthesizedExpression' || wrapper.end !== wrapped.length) {
    throw new SyntaxError(`Expected an expression: ${code}`);
  }
  const parenthesized = wrapper.expression.type === 'ParenthesizedExpression';
  normalize(program, module);
  const expression = (statement as E.ExpressionStatement).expression;
  // The wrapper's parentheses are not part of the fragment.
  outerSpans.delete(expression);
  const comment = comments.at(-1);
  const ended = comment?.type === 'Line' && comment.end === code.length + 1 ? `${code}\n` : code;
  fragments.set(expression, {
    text: code,
    placeable: expression.type === 'SequenceExpression' && !parenthesized ? `(${ended})` : ended,
  });
  return expression;
};

const KEYWORDS = new Set(
  'break case catch continue debugger default do else finally for function if return switch throw try var const while with new this super class extends export import null true false in instanceof typeof void delete'.split(
    ' '
  )
);
const STRICT_RESERVED_WORDS = new Set(
  'implements interface let package private protected public static yield await enum'.split(' ')
);

/**
 * Whether `name` can be written as an identifier. Keywords and module reserved words are rejected
 * unless `reserved` is false, as for an object key.
 */
export const isValidIdentifier = (name: string, reserved = true): boolean =>
  /^[\p{ID_Start}$_][\p{ID_Continue}$‌‍]*$/u.test(name) &&
  !(reserved && (KEYWORDS.has(name) || STRICT_RESERVED_WORDS.has(name)));
