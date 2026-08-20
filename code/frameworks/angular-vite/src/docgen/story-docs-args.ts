// Turns a resolved arg node into the Angular template expression a binding carries. Reading the args
// themselves - following spreads and names - is the shared CSF pass in `story-shape`.
import { babelPrint, types as t } from 'storybook/internal/babel';
import { keyOf, unwrapExpression } from 'storybook/internal/csf-tools';

import type { SnippetEnum } from './build-docgen.ts';
import { escapeAttributeExpression, printArgExpression } from '../arg-expression.ts';

const EVAL_FAILED = Symbol('story-docs-eval-failed');

/**
 * How a value copied out of another module has to reduce before an Angular binding can carry it.
 *
 * A binding the snippet prints names nothing outside itself, so an arg from another file may only
 * join the record once it evaluates to a value that stands on its own.
 */
export const createArgExternalizer =
  (enums: SnippetEnum[]) =>
  (node: t.Node): t.Node | undefined => {
    const value = evaluateNode(node, enums);
    return value === EVAL_FAILED ? undefined : t.valueToNode(value);
  };

export const evaluateArgBinding = (
  node: t.Node,
  enums: SnippetEnum[]
): { expression: string; fromValue: boolean } => {
  const literal = evaluateArgLiteral(node, enums);
  return {
    expression: escapeAttributeExpression(literal ?? printArgSource(unwrapExpression(node))),
    fromValue: literal !== undefined,
  };
};

/**
 * The arg's value as a standalone expression, or `undefined` when it needs the story to run.
 *
 * Unlike {@link evaluateArgBinding} this never falls back to source text, so a caller that has
 * to produce code rather than an attribute can tell a real value from a name only the story file
 * knows. The two positions share a printer, so a value reads the same wherever it lands.
 */
export const evaluateArgLiteral = (node: t.Node, enums: SnippetEnum[]): string | undefined => {
  const value = evaluateNode(unwrapExpression(node), enums);
  return value === EVAL_FAILED ? undefined : printArgExpression(value);
};

// recast reprints a node it parsed straight from the file's own text, comments and indentation
// included. A clone drops the bookkeeping that path relies on and is formatted from the AST
// instead, which is what leaves a binding holding the expression and nothing else.
const printArgSource = (node: t.Node): string => babelPrint(t.cloneNode(node, true));

const evaluateNode = (node: t.Node, enums: SnippetEnum[]): unknown => {
  const unwrapped = unwrapExpression(node);
  if (
    t.isStringLiteral(unwrapped) ||
    t.isNumericLiteral(unwrapped) ||
    t.isBooleanLiteral(unwrapped)
  ) {
    return unwrapped.value;
  }
  if (t.isNullLiteral(unwrapped)) {
    return null;
  }
  if (t.isIdentifier(unwrapped) && unwrapped.name === 'undefined') {
    return undefined;
  }
  if (t.isUnaryExpression(unwrapped) && unwrapped.operator === 'void') {
    return undefined;
  }
  if (
    t.isUnaryExpression(unwrapped) &&
    unwrapped.operator === '-' &&
    t.isNumericLiteral(unwrapped.argument)
  ) {
    return -unwrapped.argument.value;
  }
  if (t.isTemplateLiteral(unwrapped) && unwrapped.expressions.length === 0) {
    return unwrapped.quasis[0]?.value.cooked ?? EVAL_FAILED;
  }
  if (t.isArrayExpression(unwrapped)) {
    const values: unknown[] = [];
    for (const element of unwrapped.elements) {
      if (element === null || t.isSpreadElement(element)) {
        return EVAL_FAILED;
      }
      const value = evaluateNode(element, enums);
      if (value === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      values.push(value);
    }
    return values;
  }
  if (t.isObjectExpression(unwrapped)) {
    const value: Record<string, unknown> = {};
    for (const property of unwrapped.properties) {
      if (!t.isObjectProperty(property)) {
        return EVAL_FAILED;
      }
      const key = keyOf(property);
      if (key === null) {
        return EVAL_FAILED;
      }
      const propertyValue = evaluateNode(property.value, enums);
      if (propertyValue === EVAL_FAILED) {
        return EVAL_FAILED;
      }
      value[key] = propertyValue;
    }
    return value;
  }
  // `Enum.Member`: the analyzer collects referenced enums, so the member's value - what the
  // runtime generator would see - is recoverable statically.
  if (
    t.isMemberExpression(unwrapped) &&
    !unwrapped.computed &&
    t.isIdentifier(unwrapped.object) &&
    t.isIdentifier(unwrapped.property)
  ) {
    const objectName = unwrapped.object.name;
    const propertyName = unwrapped.property.name;
    const member = enums
      .find((enumeration) => enumeration.name === objectName)
      ?.members.find((candidate) => candidate.name === propertyName);
    return member?.value ?? EVAL_FAILED;
  }
  return EVAL_FAILED;
};
