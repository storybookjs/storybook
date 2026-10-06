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

const langFor = (fileName = ''): 'js' | 'jsx' | 'ts' | 'tsx' => {
  if (/\.(c|m)?tsx?$/.test(fileName)) {
    return /x$/.test(fileName) ? 'tsx' : 'ts';
  }
  // Story and config files without a known TS extension may still contain JSX or type syntax; TSX
  // is the most permissive grammar and matches Babel's `['jsx', 'typescript']` default.
  return 'tsx';
};

export const parseModule = (code: string, fileName?: string): ParsedModule => {
  const result = parseSync(fileName ?? 'file.tsx', code, {
    lang: langFor(fileName),
    sourceType: 'module',
    preserveParens: false,
  });
  const error = result.errors.find((diagnostic) => diagnostic.severity === 'Error');
  if (error) {
    const offset = error.labels?.[0]?.start;
    throw new EstreeParseError(
      error.message,
      fileName,
      offset === undefined ? undefined : locationOf(code, offset, offset)
    );
  }
  return { code, program: result.program, comments: result.comments };
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

export const isNode = (value: unknown): value is Node =>
  !!value && typeof value === 'object' && typeof (value as Node).type === 'string';

export const children = (node: Node): Node[] => {
  const keys = (visitorKeys as Record<string, readonly string[]>)[node.type] ?? [];
  const result: Node[] = [];
  for (const key of keys) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          result.push(item);
        }
      }
    } else if (isNode(value)) {
      result.push(value);
    }
  }
  return result;
};

// Depth-first walk. Return `false` from `enter` to skip a node's children.
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

// Peels TS assertion/satisfies wrappers and parentheses off an expression node.
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
// Matches Babel's semantics for string, numeric and expression-less template keys.
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

// Name of a non-computed identifier-keyed member, as Babel's `t.isIdentifier(p.key)` checks did.
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

/** Remember the source of every node under `root`, so {@link textOf} can print them later. */
export const registerSource = (root: Node, code: string) => {
  walk(root, (node) => {
    nodeSources.set(node, code);
  });
};

const textOverrides = new WeakMap<object, string>();

/** Pin the text a node prints as, e.g. an expression whose parentheses the parser dropped. */
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

/** Parse an expression from source; it and every node inside it print as the text they came from. */
export const expressionFromSource = (code: string): E.Expression => {
  const wrapped = `(${code}\n)`;
  const statement = parseModule(wrapped).program.body[0];
  if (statement?.type !== 'ExpressionStatement') {
    throw new SyntaxError(`Expected an expression: ${code}`);
  }
  registerSource(statement.expression, wrapped);
  setTextOf(statement.expression, code);
  return statement.expression;
};
