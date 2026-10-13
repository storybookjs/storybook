import { types as t } from 'storybook/internal/babel';

/**
 * Whether a literal written in place of `node` would read differently than the expression it
 * replaces: `5.toFixed()`, `--1` after a `-`, `-1 ** 2`, or an object literal as an arrow body. A
 * snippet template marks such a place as an `⟦operand⟧` hole.
 */
export const isOperand = (node: t.Node, parent: t.Node | null | undefined) =>
  ((t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
    parent.object === node) ||
  ((t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) && parent.callee === node) ||
  t.isUnaryExpression(parent) ||
  t.isBinaryExpression(parent, { operator: '**', left: node }) ||
  t.isArrowFunctionExpression(parent, { body: node });
