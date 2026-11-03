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
  textOf,
  unwrapExpression,
} from '../estree/ast.ts';
import { detachedTextOf, lineIndent, reindent } from '../estree/editor.ts';

/**
 * The code a story writes each arg with, as `StoryDoc.argCode` holds it: every arg but a plain
 * string, boolean, `null`, `undefined` or a number written as it prints, which prints as its value.
 * A number written another way, such as `1e3` or `1_000`, keeps its code, as the static snippet
 * shows it so.
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
  if (isStringLiteral(value) || isBooleanLiteral(value)) {
    return { value: value.value };
  }
  if (isNumericLiteral(value) && textOf(value) === String(value.value)) {
    return { value: value.value };
  }
  if (
    value.type === 'UnaryExpression' &&
    value.operator === '-' &&
    isNumericLiteral(value.argument) &&
    textOf(value.argument) === String(value.argument.value)
  ) {
    return { value: -value.argument.value };
  }
  if (isNullLiteral(value)) {
    return { value: null };
  }
  return isIdentifier(value, 'undefined') ? { value: undefined } : undefined;
};
