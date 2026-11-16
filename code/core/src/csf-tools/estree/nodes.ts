/**
 * Node predicates with no runtime dependency on oxc-parser, in their own module so the ESLint
 * plugin can bundle them; re-exported through ./ast.ts, which owns parsing and traversal.
 */
import type * as E from 'oxc-parser';

type Node = E.Node;

export const isNode = (value: unknown): value is Node =>
  !!value && typeof value === 'object' && typeof (value as Node).type === 'string';

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

/** Whether `node` is an identifier, and one named `name` when given. */
export const isIdentifier = (
  node: unknown,
  name?: string
): node is E.IdentifierReference | E.BindingIdentifier | E.IdentifierName =>
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
export const isTSWrapper = (node: { type: string }) => WRAPPERS.has(node.type);

/** Peel TS assertion/satisfies wrappers off an expression node. */
export const unwrapExpression = <T extends { type: string } | null | undefined>(node: T): T => {
  let current: { type: string; expression?: { type: string } } | null | undefined = node;
  while (current && isTSWrapper(current)) {
    current = current.expression;
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

/**
 * The first property of `object` whose `staticKey` is `name`, a method or accessor included: the
 * first, not the one that wins at runtime.
 */
export const objectProperty = (object: E.ObjectExpression, name: string): Property | undefined =>
  object.properties.find(
    (member): member is Property => member.type === 'Property' && staticKey(member) === name
  );

export type StaticIdentifierMemberCall = E.CallExpression & {
  callee: E.StaticMemberExpression & { object: E.IdentifierReference; property: E.IdentifierName };
};

export type CsfFactoryCall = E.CallExpression & {
  callee: E.StaticMemberExpression & { property: E.IdentifierName };
};

export const isCanonicalCsf2BindCall = (
  node: Node | null | undefined
): node is StaticIdentifierMemberCall =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  node.callee.object.type === 'Identifier' &&
  isIdentifier(node.callee.property, 'bind') &&
  (node.arguments.length === 0 ||
    (node.arguments.length === 1 &&
      node.arguments[0].type === 'ObjectExpression' &&
      node.arguments[0].properties.length === 0));

/** Receiver of a `.type<T>()` chain, which returns its receiver: `meta` for `meta.type<T>()`. */
export const withoutTypeCalls = (object: Node): Node =>
  object.type === 'CallExpression' &&
  object.arguments.length === 0 &&
  object.callee.type === 'MemberExpression' &&
  !object.callee.computed &&
  isIdentifier(object.callee.property, 'type')
    ? withoutTypeCalls(object.callee.object)
    : object;

export const isCsfFactoryCall = (node: Node | null | undefined): node is CsfFactoryCall =>
  node?.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' &&
  !node.callee.computed &&
  withoutTypeCalls(node.callee.object).type === 'Identifier' &&
  node.callee.property.type === 'Identifier' &&
  (node.callee.property.name === 'story' || node.callee.property.name === 'extend');

/** Identifier a CSF factory call is made on: `meta` in `meta.type<T>().story()`. */
export const csfFactoryReceiver = (node: CsfFactoryCall): E.IdentifierReference =>
  withoutTypeCalls(node.callee.object) as E.IdentifierReference;
