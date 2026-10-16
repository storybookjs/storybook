import { visitorKeys } from 'oxc-parser';

import {
  type E,
  type Node,
  type Property,
  isIdentifier,
  isNode,
  isNumericLiteral,
  parseModule,
  staticKey,
  unwrapExpression,
} from './ast.ts';
import { type SourceEditor, functionFromMethod } from './editor.ts';
import type { ScopeInfo } from './scope.ts';

// Node types Babel produces that OXC's ESTree output has no equivalent for (`@babel/types`
// `VISITOR_KEYS` minus `visitorKeys`, without Flow), so a Babel node is still told from data.
const BABEL_ONLY_TYPES = new Set([
  'File',
  'InterpreterDirective',
  'Directive',
  'DirectiveLiteral',
  'StringLiteral',
  'NumericLiteral',
  'BooleanLiteral',
  'NullLiteral',
  'BigIntLiteral',
  'RegExpLiteral',
  'DecimalLiteral',
  'ObjectProperty',
  'ObjectMethod',
  'ClassMethod',
  'ClassPrivateMethod',
  'ClassProperty',
  'ClassPrivateProperty',
  'ClassAccessorProperty',
  'PrivateName',
  'Import',
  'ExportNamespaceSpecifier',
  'ExportDefaultSpecifier',
  'OptionalMemberExpression',
  'OptionalCallExpression',
  'TSDeclareMethod',
  'TSExpressionWithTypeArguments',
]);

/** An object that is an AST node rather than data: a node type OXC or Babel produces. */
export const isAstLike = (value: unknown): value is Node =>
  isNode(value) && (Object.hasOwn(visitorKeys, value.type) || BABEL_ONLY_TYPES.has(value.type));

// Whether the parenthesis at index 0 closes at the last index. Then the text between them is an
// expression on its own; otherwise it starts with an unmatched `)`, which fails the parse.
const isParenthesized = (source: string) => {
  if (!source.startsWith('(') || !source.endsWith(')')) {
    return false;
  }
  try {
    parseModule(`[${source.slice(1, -1)}\n]`);
    return true;
  } catch {
    return false;
  }
};

/**
 * Source text ready to be placed as a value: a comma expression keeps its parentheses, and a
 * trailing line comment ends its line so the code after it survives.
 */
export const placeableSource = (source: string, type: string) => {
  const text = type === 'SequenceExpression' && !isParenthesized(source) ? `(${source})` : source;
  const lastComment = parseModule(`(${text}\n)`).comments.at(-1);
  return lastComment?.type === 'Line' && lastComment.end === text.length + 1 ? `${text}\n` : text;
};

/** A member's value as source; methods become function expressions. */
export const valueSource = (editor: SourceEditor, member: Property) =>
  member.method || member.kind !== 'init'
    ? functionFromMethod(editor, member)
    : editor.source(member.value);

export type CsfValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly CsfValue[]
  | { readonly [key: string]: CsfValue };

export const UNRESOLVED = Symbol('unresolved');

/** Whether evaluating the expression can have no side effect, so it may be moved freely. */
export const isEvaluationInert = (node: Node): boolean => {
  const value = unwrapExpression(node);
  if (value.type === 'TemplateLiteral') {
    return value.expressions.length === 0;
  }
  if (
    value.type === 'Literal' ||
    value.type === 'FunctionExpression' ||
    value.type === 'ArrowFunctionExpression'
  ) {
    return true;
  }
  if (value.type === 'UnaryExpression') {
    return ['!', 'void', 'typeof'].includes(value.operator)
      ? isEvaluationInert(value.argument)
      : isNumericLiteral(unwrapExpression(value.argument));
  }
  if (value.type === 'ArrayExpression') {
    return value.elements.every((element) => element === null || isEvaluationInert(element));
  }
  if (value.type === 'ObjectExpression') {
    return value.properties.every(
      (property) =>
        property.type === 'Property' &&
        property.kind === 'init' &&
        !property.method &&
        !property.computed &&
        staticKey(property) !== undefined &&
        isEvaluationInert(property.value)
    );
  }
  return false;
};

export const readValue = (scopes: ScopeInfo, node: Node): CsfValue | typeof UNRESOLVED => {
  const value = resolveExpression(scopes, node);
  if (!value) {
    return UNRESOLVED;
  }
  if (value.type === 'Literal') {
    if ('regex' in value || 'bigint' in value) {
      return UNRESOLVED;
    }
    return (value as E.StringLiteral | E.NumericLiteral | E.BooleanLiteral | E.NullLiteral).value;
  }
  if (value.type === 'Identifier') {
    return value.name === 'undefined' ? undefined : UNRESOLVED;
  }
  if (value.type === 'TemplateLiteral' && value.expressions.length === 0) {
    return value.quasis[0].value.cooked ?? UNRESOLVED;
  }
  if (value.type === 'UnaryExpression') {
    const argument = readValue(scopes, value.argument);
    if (typeof argument !== 'number') {
      return UNRESOLVED;
    }
    if (value.operator === '-') {
      return -argument;
    }
    return value.operator === '+' ? argument : UNRESOLVED;
  }
  if (value.type === 'ArrayExpression') {
    const elements: CsfValue[] = [];
    for (const element of value.elements) {
      if (!element) {
        elements.length++;
        continue;
      }
      const item = readValue(scopes, element.type === 'SpreadElement' ? element.argument : element);
      if (item === UNRESOLVED) {
        return UNRESOLVED;
      }
      if (element.type === 'SpreadElement') {
        if (!Array.isArray(item)) {
          return UNRESOLVED;
        }
        elements.push(...item);
      } else {
        elements.push(item);
      }
    }
    return elements;
  }
  if (value.type === 'ObjectExpression') {
    const entries: [string, CsfValue][] = [];
    for (const property of value.properties) {
      if (property.type === 'SpreadElement') {
        const spread = readValue(scopes, property.argument);
        if (typeof spread !== 'object' || spread === null || Array.isArray(spread)) {
          return UNRESOLVED;
        }
        entries.push(...Object.entries(spread));
        continue;
      }
      const key = staticKey(property);
      if (
        property.kind !== 'init' ||
        property.method ||
        key === undefined ||
        (key === '__proto__' && !property.computed)
      ) {
        return UNRESOLVED;
      }
      const item = readValue(scopes, property.value);
      if (item === UNRESOLVED) {
        return UNRESOLVED;
      }
      entries.push([key, item]);
    }
    return Object.fromEntries(entries);
  }
  return UNRESOLVED;
};

export const resolveExpression = (scopes: ScopeInfo, node: Node): Node | undefined => {
  let value = unwrapExpression(node);
  const visited = new Set<Node>();
  while (isIdentifier(value) && !visited.has(value)) {
    visited.add(value);
    const binding = scopes.bindingOf(value);
    if (!binding && value.name === 'undefined') {
      return value;
    }
    if (
      !binding?.constant ||
      binding.references.length !== 1 ||
      binding.references[0] !== value ||
      binding.node.type !== 'VariableDeclarator' ||
      binding.node.id.type !== 'Identifier' ||
      !binding.node.init
    ) {
      return undefined;
    }
    value = unwrapExpression(binding.node.init);
  }
  return value;
};
