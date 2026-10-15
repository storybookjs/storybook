import type { CsfFile, ReferenceContext, ResolvedMembers } from 'storybook/internal/csf-tools';
import {
  loadCsf,
  resolveBindingMembers,
  resolveObjectMembers,
  sourceOf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';
import { recast, types as t } from 'storybook/internal/babel';

import { readFileSync } from 'node:fs';

export type WebComponentsComponentResolution =
  | { tag: string }
  | { reason: 'no-meta-component' }
  | { reason: 'component-not-a-tag'; expression: string }
  | { reason: 'unresolvable-meta-spread'; spread: string };

export function parseStoryFile(storyFilePath: string, title: string): CsfFile | undefined {
  try {
    const source = readFileSync(storyFilePath, 'utf8');
    return loadCsf(source, { makeTitle: () => title }).parse();
  } catch {
    return undefined;
  }
}

const expressionFor = (node: t.Node): string => recast.print(node).code;

function tagFromNode(node: t.Node): WebComponentsComponentResolution {
  const expression = expressionFor(node);
  const unwrapped = unwrapExpression(node);
  if (t.isStringLiteral(unwrapped) && unwrapped.value !== '') {
    return { tag: unwrapped.value };
  }
  if (t.isTemplateLiteral(unwrapped) && unwrapped.expressions.length === 0) {
    const tag = unwrapped.quasis[0]?.value.cooked;
    if (tag) {
      return { tag };
    }
  }
  return { reason: 'component-not-a-tag', expression };
}

/**
 * Reads `component` from the meta object, following spreads of objects declared in the story file.
 *
 * @example
 *
 * ```ts
 * const meta = { component: 'x-tabs' } satisfies Meta;
 * export default { ...meta, tags: ['autodocs'] }; // { tag: 'x-tabs' }
 * ```
 */
export function resolveStoryComponent(csf: CsfFile): WebComponentsComponentResolution {
  if (!csf._metaNode) {
    return { reason: 'no-meta-component' };
  }
  const ctx: ReferenceContext = { program: csf._file.path, filePath: csf._options.fileName ?? '' };
  const members = resolveObjectMembers(csf._metaNode, ctx);
  return componentIn(members, csf._metaNode, ctx, new Set()) ?? { reason: 'no-meta-component' };
}

/** The last write of `component`, or `undefined` when nothing knowably writes it. */
function componentIn(
  members: ResolvedMembers,
  object: t.ObjectExpression,
  ctx: ReferenceContext,
  visited: Set<t.ObjectExpression>
): WebComponentsComponentResolution | undefined {
  const component = members.properties.component;
  if (component && !members.shadowed.includes('component')) {
    return tagFromNode(component);
  }

  // The helper drops a spread it cannot read whole, yet a literal written after the unreadable part
  // still wins at runtime, so each unreadable spread is read again from the last one back.
  const unreadable = object.properties
    .filter((property): property is t.SpreadElement => t.isSpreadElement(property))
    .filter((spread) => members.unresolved.includes(sourceOf(spread)))
    .reverse();
  for (const spread of unreadable) {
    const found = spreadComponent(spread, ctx, visited);
    if (found || component) {
      return found ?? { reason: 'unresolvable-meta-spread', spread: sourceOf(spread) };
    }
  }
  return component && tagFromNode(component);
}

function spreadComponent(
  spread: t.SpreadElement,
  ctx: ReferenceContext,
  visited: Set<t.ObjectExpression>
): WebComponentsComponentResolution | undefined {
  const argument = unwrapExpression(spread.argument);
  const local = localObject(argument, ctx);
  if (!local || visited.has(local.object)) {
    return { reason: 'unresolvable-meta-spread', spread: sourceOf(spread) };
  }
  return componentIn(local.members, local.object, ctx, new Set(visited).add(local.object));
}

/** The object literal a spread argument writes out or names, with the members it resolves to. */
function localObject(
  argument: t.Node,
  ctx: ReferenceContext
): { object: t.ObjectExpression; members: ResolvedMembers } | undefined {
  if (t.isObjectExpression(argument)) {
    return { object: argument, members: resolveObjectMembers(argument, ctx) };
  }
  if (!t.isIdentifier(argument)) {
    return undefined;
  }
  const declarator = ctx.program.scope.getBinding(argument.name)?.path.node;
  const init =
    t.isVariableDeclarator(declarator) && declarator.init
      ? unwrapExpression(declarator.init)
      : undefined;
  // The binding read keeps the constancy check and any `meta.component = …` assignment.
  const members = resolveBindingMembers(ctx, argument.name);
  return t.isObjectExpression(init) && members ? { object: init, members } : undefined;
}
