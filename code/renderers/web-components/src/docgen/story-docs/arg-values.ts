import { types as t } from 'storybook/internal/babel';
import { keyOf, sourceOf, templateParts, unwrapExpression } from 'storybook/internal/csf-tools';

export type ArgValue =
  | { kind: 'value'; value: unknown }
  | { kind: 'function' }
  | { kind: 'unset' }
  | { kind: 'unresolved'; source: string };
const FAILED = Symbol('failed');

export function evaluateArgValue(node: t.Node): ArgValue {
  const value = evaluate(node);
  if (value === FAILED) {
    const unwrapped = unwrapExpression(node);
    return t.isFunction(unwrapped)
      ? { kind: 'function' }
      : { kind: 'unresolved', source: sourceOf(node) };
  }
  if (value === undefined) {
    return { kind: 'unset' };
  }
  return { kind: 'value', value };
}
const evaluate = (node: t.Node): unknown | typeof FAILED => {
  const unwrapped = unwrapExpression(node);
  if (
    t.isStringLiteral(unwrapped) ||
    t.isNumericLiteral(unwrapped) ||
    t.isBooleanLiteral(unwrapped)
  ) {
    return unwrapped.value;
  }
  if (t.isNullLiteral(unwrapped)) return null;
  if (t.isIdentifier(unwrapped, { name: 'undefined' })) return undefined;
  if (t.isUnaryExpression(unwrapped) && unwrapped.operator === 'void') return undefined;
  if (
    t.isUnaryExpression(unwrapped) &&
    (unwrapped.operator === '-' || unwrapped.operator === '+') &&
    t.isNumericLiteral(unwrapped.argument)
  ) {
    return unwrapped.operator === '-' ? -unwrapped.argument.value : unwrapped.argument.value;
  }
  const parts = templateParts(unwrapped);
  if (parts && parts.expressions.length === 0) {
    return parts.quasis[0] ?? FAILED;
  }
  if (t.isFunction(unwrapped)) return FAILED;
  if (t.isArrayExpression(unwrapped)) return evaluateArray(unwrapped);
  if (t.isObjectExpression(unwrapped)) return evaluateObject(unwrapped);
  return FAILED;
};
const evaluateArray = (node: t.ArrayExpression): unknown[] | typeof FAILED => {
  const values: unknown[] = [];
  for (const element of node.elements) {
    if (element === null || t.isSpreadElement(element)) {
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
const evaluateObject = (node: t.ObjectExpression): Record<string, unknown> | typeof FAILED => {
  const values: Record<string, unknown> = {};
  for (const property of node.properties) {
    if (!t.isObjectProperty(property) || property.computed || t.isSpreadElement(property)) {
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
