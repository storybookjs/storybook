import { recast, types as t } from 'storybook/internal/babel';
import type { Args } from 'storybook/internal/types';

import { type FillSnippetTemplate, writtenArg } from '../../docs-tools/snippetTemplate.ts';
import { unwrapExpression } from './utils.ts';

/**
 * The code a story writes each arg with, as `StoryDoc.argCode` holds it: every arg but a plain
 * string, number, boolean, `null` or `undefined`, which prints as its value. Code that is not a
 * simple value, such as `MB * 5` or an arrow function, is wrapped in parentheses unless the story
 * wrote them, so it reads the same in any hole, as in `(MB * 5).toFixed(0)`.
 */
export function argCode(args: Record<string, t.Node>): Record<string, string> {
  const code: Record<string, string> = {};
  for (const [name, node] of Object.entries(args)) {
    if (!literalOf(node)) {
      code[name] = printArg(unwrapExpression(node));
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
  args: Record<string, t.Node>,
  fill: FillSnippetTemplate
): string {
  const code = argCode(args);
  const values: Args = {};
  for (const [name, node] of Object.entries(args)) {
    values[name] = name in code ? writtenArg(code[name]!) : literalOf(node)!.value;
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
  args: Record<string, t.Node>,
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

const literalOf = (node: t.Node): { value: unknown } | undefined => {
  const value = unwrapExpression(node);
  if (t.isStringLiteral(value) || t.isNumericLiteral(value) || t.isBooleanLiteral(value)) {
    return { value: value.value };
  }
  if (t.isUnaryExpression(value, { operator: '-' }) && t.isNumericLiteral(value.argument)) {
    return { value: -value.argument.value };
  }
  if (t.isNullLiteral(value)) {
    return { value: null };
  }
  return t.isIdentifier(value, { name: 'undefined' }) ? { value: undefined } : undefined;
};

const printArg = (node: t.Node): string => {
  const code = recast.print(node).code;
  return isSimpleValue(node, code) || node.extra?.parenthesized ? code : `(${code})`;
};

// A value no code around it reads differently; `new Foo` without arguments would take a member.
// Code the story wrote in parentheses prints with them already.
const isSimpleValue = (node: t.Node, code: string) =>
  t.isIdentifier(node) ||
  t.isJSXElement(node) ||
  t.isJSXFragment(node) ||
  t.isThisExpression(node) ||
  t.isLiteral(node) ||
  t.isArrayExpression(node) ||
  t.isObjectExpression(node) ||
  t.isMemberExpression(node) ||
  t.isOptionalMemberExpression(node) ||
  t.isCallExpression(node) ||
  t.isOptionalCallExpression(node) ||
  t.isTaggedTemplateExpression(node) ||
  (t.isNewExpression(node) && code.endsWith(')'));
