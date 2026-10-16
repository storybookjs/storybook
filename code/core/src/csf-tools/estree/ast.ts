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

const langFor = (fileName: string): Lang => {
  if (/\.(c|m)?tsx?$/.test(fileName)) {
    return /x$/.test(fileName) ? 'tsx' : 'ts';
  }
  // Files without a TS extension may still contain JSX or type syntax, and TSX accepts both.
  return 'tsx';
};

type ParseAttempt = { module: ParsedModule } | { error: EstreeParseError; offset: number };

const parseWith = (code: string, fileName: string | undefined, lang: Lang): ParseAttempt => {
  const result = parseSync(fileName ?? `file.${lang}`, code, {
    lang,
    sourceType: 'module',
    preserveParens: false,
    // Duplicate declarations and legacy octals are reported like Babel did, instead of parsing
    // into a program that silently keeps the last declaration.
    showSemanticErrors: true,
  });
  const error = result.errors.find((diagnostic) => diagnostic.severity === 'Error');
  if (error) {
    const offset = error.labels?.[0]?.start ?? 0;
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

/**
 * Parse a module. Without a file name there is no grammar to pick: TSX accepts the most, but
 * rejects generic arrows and `<T>value` assertions that `.ts` allows, so TS is tried next and the
 * error of the parse that got further is reported.
 */
export const parseModule = (code: string, fileName?: string): ParsedModule => {
  const attempt = fileName ? parseWith(code, fileName, langFor(fileName)) : parseUnnamed(code);
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

const parseUnnamed = (code: string): ParseAttempt => {
  const tsx = parseWith(code, undefined, 'tsx');
  if ('module' in tsx) {
    return tsx;
  }
  const ts = parseWith(code, undefined, 'ts');
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
  const text = (code.split('\n')[line - 1] ?? '').replace(/\r$/, '');
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
  'ParenthesizedExpression',
]);

/** Peel TS assertion/satisfies wrappers and parentheses off an expression node. */
export const unwrapExpression = <T extends Node | null | undefined>(node: T): T => {
  let current: Node | null | undefined = node;
  while (current && WRAPPERS.has(current.type)) {
    current = (current as { expression: Node }).expression;
  }
  return current as T;
};

// Object literal properties written as `key: value`, methods or accessors (not spreads).
export type Property = E.ObjectProperty;

// Static key of an object member, or `undefined` when only running the code would produce it.
export const staticKey = (member: Property): string | undefined => {
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

// Ignores `computed` on purpose, matching the Babel `t.isIdentifier(p.key)` checks.
export const identifierKey = (member: Node): string | undefined =>
  member.type === 'Property' && member.key.type === 'Identifier' ? member.key.name : undefined;

export const objectProperty = (object: E.ObjectExpression, name: string): Property | undefined =>
  object.properties.find(
    (member): member is Property => member.type === 'Property' && staticKey(member) === name
  );

export const sourceOf = (code: string, node: { start: number; end: number }) =>
  code.slice(node.start, node.end);

// The code each registered node was parsed from, so a node can be printed without its module.
const nodeSources = new WeakMap<object, string>();

// Lets `textOf` print every node under `root`.
export const registerSource = (root: Node, code: string) => {
  walk(root, (node) => {
    nodeSources.set(node, code);
  });
};

const textOverrides = new WeakMap<object, string>();

// Pin the text a node prints as, e.g. an expression whose parentheses the parser dropped.
export const setTextOf = (node: Node, text: string) => {
  textOverrides.set(node, text);
};

/** Original source text of a registered node, or `undefined` for a node of unknown origin. */
export const textOf = (node: Node): string | undefined => {
  const override = textOverrides.get(node);
  if (override !== undefined) {
    return override;
  }
  const code = nodeSources.get(node);
  const span = node as Node & { start: number; end: number };
  return code === undefined ? undefined : code.slice(span.start, span.end);
};

/** Parse an expression fragment, which has no file name to pick its grammar. */
export const parseFragment = (code: string): ParsedModule => parseModule(code);

export const expressionFromSource = (code: string): E.Expression => {
  const wrapped = `(${code}\n)`;
  const statement = parseFragment(wrapped).program.body[0];
  if (statement?.type !== 'ExpressionStatement') {
    throw new SyntaxError(`Expected an expression: ${code}`);
  }
  registerSource(statement.expression, wrapped);
  setTextOf(statement.expression, code);
  return statement.expression;
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
