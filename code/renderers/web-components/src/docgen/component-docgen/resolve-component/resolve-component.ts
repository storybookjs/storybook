import {
  type CsfFile,
  type ESTree,
  type ESTreeNode,
  type ReferenceContext,
  type ResolvedMembers,
  isStringLiteral,
  loadCsf,
  oneLineTextOf,
  resolveBindingMembers,
  resolveObjectMembers,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import { readFileSync } from 'node:fs';

export type WebComponentsComponentResolution =
  | { tag: string }
  | { reason: 'no-meta-component' }
  | { reason: 'component-not-a-tag'; expression: string }
  | { reason: 'unresolvable-meta-spread'; spread: string };

export function parseStoryFile(storyFilePath: string, title: string): CsfFile | undefined {
  try {
    const source = readFileSync(storyFilePath, 'utf8');
    return loadCsf(source, { makeTitle: () => title, fileName: storyFilePath }).parse();
  } catch {
    return undefined;
  }
}

function tagFromNode(csf: CsfFile, node: ESTreeNode): WebComponentsComponentResolution {
  const unwrapped = unwrapExpression(node);
  if (isStringLiteral(unwrapped) && unwrapped.value !== '') {
    return { tag: unwrapped.value };
  }
  if (unwrapped.type === 'TemplateLiteral' && unwrapped.expressions.length === 0) {
    const tag = unwrapped.quasis[0]?.value.cooked;
    if (tag) {
      return { tag };
    }
  }
  return { reason: 'component-not-a-tag', expression: csf._editor.source(node) };
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
  const ctx: ReferenceContext = { editor: csf._editor, filePath: csf._options.fileName ?? '' };
  const members = resolveObjectMembers(csf._metaNode, ctx);
  return (
    componentIn(csf, members, csf._metaNode, ctx, new Set()) ?? { reason: 'no-meta-component' }
  );
}

/** The last write of `component`, or `undefined` when nothing knowably writes it. */
function componentIn(
  csf: CsfFile,
  members: ResolvedMembers,
  object: ESTree.ObjectExpression,
  ctx: ReferenceContext,
  visited: Set<ESTree.ObjectExpression>
): WebComponentsComponentResolution | undefined {
  const component = members.properties.component;
  if (component && !members.shadowed.includes('component')) {
    return tagFromNode(csf, component);
  }

  // The helper drops a spread it cannot read whole, yet a literal written after the unreadable part
  // still wins at runtime, so each unreadable spread is read again from the last one back.
  const unreadable = object.properties
    .filter((property): property is ESTree.SpreadElement => property.type === 'SpreadElement')
    .filter((spread) => members.unresolved.includes(oneLineTextOf(spread)))
    .reverse();
  for (const spread of unreadable) {
    const found = spreadComponent(csf, spread, ctx, visited);
    if (found || component) {
      return found ?? { reason: 'unresolvable-meta-spread', spread: oneLineTextOf(spread) };
    }
  }
  return component && tagFromNode(csf, component);
}

function spreadComponent(
  csf: CsfFile,
  spread: ESTree.SpreadElement,
  ctx: ReferenceContext,
  visited: Set<ESTree.ObjectExpression>
): WebComponentsComponentResolution | undefined {
  const local = localObject(unwrapExpression(spread.argument), ctx);
  if (!local || visited.has(local.object)) {
    return { reason: 'unresolvable-meta-spread', spread: oneLineTextOf(spread) };
  }
  return componentIn(csf, local.members, local.object, ctx, new Set(visited).add(local.object));
}

/** The object literal a spread argument writes out or names, with the members it resolves to. */
function localObject(
  argument: ESTreeNode,
  ctx: ReferenceContext
): { object: ESTree.ObjectExpression; members: ResolvedMembers } | undefined {
  if (argument.type === 'ObjectExpression') {
    return { object: argument, members: resolveObjectMembers(argument, ctx) };
  }
  if (argument.type !== 'Identifier') {
    return undefined;
  }
  const declarator = ctx.editor.scopes.program.bindings.get(argument.name)?.node;
  const init =
    declarator?.type === 'VariableDeclarator' && declarator.init
      ? unwrapExpression(declarator.init)
      : undefined;
  // The binding read keeps the constancy check and any `meta.component = …` assignment.
  const members = resolveBindingMembers(ctx, argument.name);
  return init?.type === 'ObjectExpression' && members ? { object: init, members } : undefined;
}
