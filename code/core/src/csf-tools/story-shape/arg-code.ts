import {
  type Node,
  isBooleanLiteral,
  isIdentifier,
  isNullLiteral,
  isNumericLiteral,
  isStringLiteral,
  moduleOf,
  outerSpan,
  sourceOf,
  unwrapExpression,
} from '../estree/ast.ts';
import { detachedTextOf, lineIndent, reindent } from '../estree/editor.ts';

/**
 * The code a story writes each arg with, as `StoryDoc.argCode` holds it: every arg but a plain
 * string, number, boolean, `null` or `undefined`, which prints as its value. An `⟦operand⟧` hole
 * puts the code in parentheses where it needs them, as in `(MB * 5).toFixed(0)`; see `asOperand`.
 */
export function argCode(args: Record<string, Node>): Record<string, string> {
  const code: Record<string, string> = {};
  for (const [name, node] of Object.entries(args)) {
    if (!literalOf(node)) {
      code[name] = writtenCode(unwrapExpression(node));
    }
  }
  return code;
}

// The code of a node as the story wrote it, with the parentheses around it, at no indentation.
const writtenCode = (node: Node): string => {
  const outer = outerSpan(node);
  const module = moduleOf(node);
  if (outer === node || !module) {
    return detachedTextOf(node);
  }
  return reindent(sourceOf(module.code, outer), lineIndent(module.code, outer.start), '');
};

const literalOf = (node: Node): { value: unknown } | undefined => {
  const value = unwrapExpression(node);
  if (isStringLiteral(value) || isNumericLiteral(value) || isBooleanLiteral(value)) {
    return { value: value.value };
  }
  if (
    value.type === 'UnaryExpression' &&
    value.operator === '-' &&
    isNumericLiteral(value.argument)
  ) {
    return { value: -value.argument.value };
  }
  if (isNullLiteral(value)) {
    return { value: null };
  }
  return isIdentifier(value, 'undefined') ? { value: undefined } : undefined;
};
