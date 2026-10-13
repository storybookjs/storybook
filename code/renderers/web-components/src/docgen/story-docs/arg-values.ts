import {
  type ESTree as E,
  type ESTreeNode as Node,
  keyOf,
  sourceOf,
  templateParts,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

export type ArgValue =
  | { kind: 'value'; value: unknown }
  | { kind: 'function' }
  | { kind: 'unset' }
  | { kind: 'unresolved'; source: string };
export const FAILED = Symbol('failed');

export const isFunctionNode = (node: Node): boolean =>
  node.type === 'ArrowFunctionExpression' ||
  node.type === 'FunctionExpression' ||
  node.type === 'FunctionDeclaration';

// Value of a string, number, boolean or `null` literal, or `FAILED` for any other node.
export const primitiveLiteralValue = (node: Node): unknown => {
  if (node.type !== 'Literal') {
    return FAILED;
  }
  if (['string', 'number', 'boolean'].includes(typeof node.value)) {
    return node.value;
  }
  return node.value === null && !('regex' in node) && !('bigint' in node) ? null : FAILED;
};

export function evaluateArgValue(node: Node): ArgValue {
  const value = evaluate(node);
  if (value === FAILED) {
    const unwrapped = unwrapExpression(node);
    return isFunctionNode(unwrapped)
      ? { kind: 'function' }
      : { kind: 'unresolved', source: sourceOf(node) };
  }
  if (value === undefined) {
    return { kind: 'unset' };
  }
  return { kind: 'value', value };
}
const evaluate = (node: Node): unknown | typeof FAILED => {
  const unwrapped = unwrapExpression(node);
  const literal = primitiveLiteralValue(unwrapped);
  if (literal !== FAILED) return literal;
  if (unwrapped.type === 'Identifier' && unwrapped.name === 'undefined') return undefined;
  if (unwrapped.type === 'UnaryExpression' && unwrapped.operator === 'void') return undefined;
  if (
    unwrapped.type === 'UnaryExpression' &&
    (unwrapped.operator === '-' || unwrapped.operator === '+') &&
    unwrapped.argument.type === 'Literal' &&
    typeof unwrapped.argument.value === 'number'
  ) {
    return unwrapped.operator === '-' ? -unwrapped.argument.value : unwrapped.argument.value;
  }
  const parts = templateParts(unwrapped);
  if (parts && parts.expressions.length === 0) {
    return parts.quasis[0] ?? FAILED;
  }
  if (isFunctionNode(unwrapped)) return FAILED;
  if (unwrapped.type === 'ArrayExpression') return evaluateArray(unwrapped);
  if (unwrapped.type === 'ObjectExpression') return evaluateObject(unwrapped);
  return FAILED;
};
const evaluateArray = (node: E.ArrayExpression): unknown[] | typeof FAILED => {
  const values: unknown[] = [];
  for (const element of node.elements) {
    if (element === null || element.type === 'SpreadElement') {
      return FAILED;
    }
    const value = evaluate(element);
    if (value === FAILED) {
      return FAILED;
    }
    values.push(value);
  }
  return values;
};
const evaluateObject = (node: E.ObjectExpression): Record<string, unknown> | typeof FAILED => {
  const values: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (
      property.type !== 'Property' ||
      property.method ||
      property.kind !== 'init' ||
      property.computed
    ) {
      return FAILED;
    }
    const key = keyOf(property);
    const value = evaluate(property.value);
    if (key === null || value === FAILED) {
      return FAILED;
    }
    values[key] = value;
  }
  return values;
};
