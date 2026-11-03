import type { Args } from 'storybook/internal/types';

import { type FillSnippetTemplate, writtenArg } from '../../docs-tools/snippetTemplate.ts';
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

/**
 * Fills a template with the args the story is written with, as the preview fills it while no
 * control has changed them: an arg with {@link argCode} as that code, any other as its value. So
 * this is the story's static snippet. `fill` is the renderer's own filler, and throws as it does.
 */
export function fillWithStoryArgs(
  template: string,
  args: Record<string, Node>,
  fill: FillSnippetTemplate
): string {
  const code = argCode(args);
  const values: Args = {};
  for (const [name, node] of Object.entries(args)) {
    values[name] = Object.hasOwn(code, name) ? writtenArg(code[name]!) : literalOf(node)!.value;
  }
  return fill(template, values);
}

/** A story's template, with its static snippet and what the preview fills it with. */
export interface StoryTemplate {
  snippet: string;
  template: string;
  argCode: Record<string, string>;
  templateWarning?: string;
}

/**
 * The story's template with its static snippet, the template filled by {@link fillWithStoryArgs},
 * or `undefined` where the filler cannot print an arg the story is written with: such a story has
 * no template, and the provider prints its snippet as it does without one. `warning` is what the
 * filled template still leaves out: the provider's warning, or the part of it that still holds once
 * a control changes the args.
 */
export function fillStoryTemplate(
  template: string,
  args: Record<string, Node>,
  fill: FillSnippetTemplate,
  warning?: string
): StoryTemplate | undefined {
  let snippet: string;
  try {
    snippet = fillWithStoryArgs(template, args, fill);
  } catch (error) {
    // By name, as each bundle that throws it can hold its own copy of the class.
    if (error instanceof Error && error.name === 'UnprintableArgError') {
      return undefined;
    }
    throw error;
  }
  return {
    snippet,
    template,
    argCode: argCode(args),
    ...(warning === undefined ? {} : { templateWarning: warning }),
  };
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
