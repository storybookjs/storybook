import { types as t } from 'storybook/internal/babel';

/**
 * Whether a literal written in place of `node` would read differently than the expression it
 * replaces: `5.toFixed()`, `--1` after a `-`, `-1 ** 2`, or an object literal that starts an arrow
 * body. `ancestors` holds the nodes around `node`, the nearest first. A snippet template marks such
 * a place as an `⟦operand⟧` hole.
 */
export function isOperand(node: t.Node, ancestors: t.Node[]) {
  const [parent] = ancestors;
  return (
    ((t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
      parent.object === node) ||
    ((t.isCallExpression(parent) || t.isOptionalCallExpression(parent)) &&
      parent.callee === node) ||
    t.isUnaryExpression(parent, { operator: '-' }) ||
    t.isBinaryExpression(parent, { operator: '**', left: node }) ||
    ancestors.some(
      (ancestor) => t.isArrowFunctionExpression(ancestor) && ancestor.body.start === node.start
    )
  );
}
