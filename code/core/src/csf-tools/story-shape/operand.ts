import { type Node, isNumericLiteral, outerSpan, unwrapExpression } from '../estree/ast.ts';

/**
 * Whether a value written in place of `node` would read differently than the expression it
 * replaces: a literal in `5.toFixed()`, `--1` or `a--1` after a `-`, `-1 ** 2`, a call in `new
 * f()()` or `class extends f()`, or an object literal that starts an arrow body or a statement.
 * `ancestors` holds the nodes around `node`, the nearest first. `written` is the node the story
 * writes the arg with, whose code the snippet prints while the arg keeps that value: unless it binds
 * as tightly as a name, as `() => null` or `a ? b : c` does not, it also reads differently next to
 * an operator, as in `!args.onClick`, `args.onClick || noop` or `args.onChange as Listener`. A
 * snippet template marks such a place as an `⟦operand⟧` hole.
 */
export function isOperand(node: Node, ancestors: Node[], written?: Node) {
  const [parent] = ancestors;
  return (
    (parent?.type === 'MemberExpression' && parent.object === node) ||
    ((parent?.type === 'CallExpression' || parent?.type === 'NewExpression') &&
      parent.callee === node) ||
    ((parent?.type === 'ClassExpression' || parent?.type === 'ClassDeclaration') &&
      parent.superClass === node) ||
    (parent?.type === 'UnaryExpression' && parent.operator === '-') ||
    (parent?.type === 'BinaryExpression' &&
      ((parent.operator === '-' && parent.right === node) ||
        (parent.operator === '**' && parent.left === node))) ||
    ancestors.some(
      (ancestor) =>
        (ancestor.type === 'ArrowFunctionExpression' && ancestor.body.start === node.start) ||
        (ancestor.type === 'ExpressionStatement' && ancestor.start === node.start)
    ) ||
    (written !== undefined && !isPrimary(unwrapExpression(written)) && isOperator(parent, node))
  );
}

// An operator that would take part of code written in place of `node`.
const isOperator = (parent: Node | undefined, node: Node) => {
  switch (parent?.type) {
    case 'UnaryExpression':
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'AwaitExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSTypeAssertion':
      return true;
    case 'ConditionalExpression':
      return parent.test === node;
    case 'TaggedTemplateExpression':
      return parent.tag === node;
    default:
      return false;
  }
};

// Code no operator next to it takes apart, such as a name, a call, a literal or `-1`.
const isPrimary = (node: Node) => {
  if (outerSpan(node) !== node) {
    // Written in parentheses.
    return true;
  }
  switch (node.type) {
    case 'Identifier':
    case 'ThisExpression':
    case 'MemberExpression':
    case 'CallExpression':
    case 'ChainExpression':
    case 'NewExpression':
    case 'TaggedTemplateExpression':
    case 'Literal':
    case 'TemplateLiteral':
    case 'ArrayExpression':
    case 'ObjectExpression':
    case 'JSXElement':
    case 'JSXFragment':
      return true;
    case 'UnaryExpression':
      return node.operator === '-' && isNumericLiteral(node.argument);
    default:
      return false;
  }
};
