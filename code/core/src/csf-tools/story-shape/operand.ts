import { types as t } from 'storybook/internal/babel';

import { unwrapExpression } from './utils.ts';

/**
 * Whether a value written in place of `node` would read differently than the expression it
 * replaces: a literal in `5.toFixed()`, `--1` or `a--1` after a `-`, `-1 ** 2`, or an object literal
 * that starts an arrow body or a statement. `ancestors` holds the nodes around `node`, the nearest
 * first. `written` is the node the story writes the arg with, whose code the snippet prints while
 * the arg keeps that value: unless it binds as tightly as a name, as `() => null` or `a ? b : c`
 * does not, it also reads differently next to an operator, as in `!args.onClick`,
 * `args.onClick || noop` or `args.onChange as Listener`. A snippet template marks such a place as an
 * `⟦operand⟧` hole.
 */
export function isOperand(node: t.Node, ancestors: t.Node[], written?: t.Node) {
  const [parent] = ancestors;
  return (
    ((t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
      parent.object === node) ||
    ((t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
      parent.callee === node) ||
    t.isUnaryExpression(parent, { operator: '-' }) ||
    t.isBinaryExpression(parent, { operator: '-', right: node }) ||
    t.isBinaryExpression(parent, { operator: '**', left: node }) ||
    ancestors.some(
      (ancestor) =>
        (t.isArrowFunctionExpression(ancestor) && ancestor.body.start === node.start) ||
        (t.isExpressionStatement(ancestor) && ancestor.start === node.start)
    ) ||
    (written !== undefined && !isPrimary(unwrapExpression(written)) && isOperator(parent, node))
  );
}

// An operator that would take part of code written in place of `node`.
const isOperator = (parent: t.Node | undefined, node: t.Node) =>
  t.isUnaryExpression(parent) ||
  t.isBinaryExpression(parent) ||
  t.isLogicalExpression(parent) ||
  t.isConditionalExpression(parent, { test: node }) ||
  t.isAwaitExpression(parent) ||
  t.isTaggedTemplateExpression(parent, { tag: node }) ||
  t.isTSAsExpression(parent) ||
  t.isTSSatisfiesExpression(parent) ||
  t.isTSNonNullExpression(parent) ||
  t.isTSTypeAssertion(parent);

// Code no operator next to it takes apart, such as a name, a call, a literal or `-1`.
const isPrimary = (node: t.Node) =>
  !!node.extra?.parenthesized ||
  t.isIdentifier(node) ||
  t.isThisExpression(node) ||
  t.isMemberExpression(node) ||
  t.isOptionalMemberExpression(node) ||
  t.isCallExpression(node) ||
  t.isOptionalCallExpression(node) ||
  t.isNewExpression(node) ||
  t.isTaggedTemplateExpression(node) ||
  t.isLiteral(node) ||
  t.isArrayExpression(node) ||
  t.isObjectExpression(node) ||
  t.isJSXElement(node) ||
  t.isJSXFragment(node) ||
  (t.isUnaryExpression(node, { operator: '-' }) && t.isNumericLiteral(node.argument));
