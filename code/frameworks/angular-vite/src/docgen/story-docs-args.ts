// Turns a resolved arg node into the Angular template expression a binding carries. Reading the args
// themselves - following spreads and names - is the shared CSF pass in `story-shape`.
import { babelPrint, types as t } from 'storybook/internal/babel';
import { keyOf, unwrapExpression } from 'storybook/internal/csf-tools';

import type { SnippetEnum } from './build-docgen.ts';
import { isValidIdentifier } from '../template-grammar.ts';

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

// An arg no static evaluation could reduce to a value falls back to its source text. Every
// expression is escaped for the attribute position it lands in: the double-quote delimiter and
// text Angular's lexer would decode as a character reference survive the round-trip unchanged.
export const evaluateArgExpression = (node: t.Node, enums: SnippetEnum[]): string => {
  const literal = evaluateArgLiteral(node, enums);
  return escapeAttributeExpression(literal ?? printArgSource(unwrapExpression(node)));
};

/**
 * The arg's value as a standalone expression, or `undefined` when it needs the story to run.
 *
 * Unlike {@link evaluateArgExpression} this never falls back to source text, so a caller that has
 * to produce code rather than an attribute can tell a real value from a name only the story file
 * knows. The two positions share a printer, so a value reads the same wherever it lands.
 */
export const evaluateArgLiteral = (node: t.Node, enums: SnippetEnum[]): string | undefined => {
  const value = evaluateNode(unwrapExpression(node), enums);
  return value === EVAL_FAILED ? undefined : printExpressionValue(value, new Set());
};

export const argFieldValue = (node: t.Node): string => printArgSource(unwrapExpression(node));

// recast reprints a node it parsed straight from the file's own text, comments and indentation
// included. A clone drops the bookkeeping that path relies on and is formatted from the AST
// instead, which is what leaves a binding holding the expression and nothing else.
const printArgSource = (node: t.Node): string => babelPrint(t.cloneNode(node, true));

// Angular expression strings support backslash escapes, so quoting stays lossless.
const quoteExpressionString = (value: string): string =>
  `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;

// Renders an evaluated arg as a template expression, in the same shape the runtime generator
// prints, but losslessly for strings carrying quotes.
const printExpressionValue = (value: unknown, seen: Set<unknown>): string => {
  if (typeof value === 'string') {
    return quoteExpressionString(value);
  }
  if (typeof value !== 'object' || value === null) {
    return `${value}`;
  }
  if (seen.has(value)) {
    return quoteExpressionString('[Circular]');
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return `[${value.map((element) => printExpressionValue(element ?? null, seen)).join(', ')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(
      ([key, entryValue]) =>
        `${isValidIdentifier(key) ? key : quoteExpressionString(key)}: ${printExpressionValue(entryValue, seen)}`
    );
  return `{${entries.join(', ')}}`;
};

const escapeAttributeExpression = (expression: string): string =>
  expression.replace(/&(?=#|\w+;)/g, '&amp;').replace(/"/g, '&quot;');

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
