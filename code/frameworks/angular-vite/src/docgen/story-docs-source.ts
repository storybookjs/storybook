import type {
  ESTreeNode as Node,
  ReferenceContext,
  ResolvedMembers,
} from 'storybook/internal/csf-tools';
import {
  isStringLiteral,
  resolveArgValue,
  resolveObjectMembers,
  sourceOf,
  unwrapExpression,
} from 'storybook/internal/csf-tools';

import type { StoryShape } from './story-docs-markup.ts';
import { templateParts } from './story-docs-markup.ts';

export type AuthoredSource =
  | { kind: 'missing' }
  | { kind: 'disabled' }
  | { kind: 'code'; code: string }
  | { kind: 'unresolvable'; source: string };

type MemberPathResolution =
  | { kind: 'value'; node: Node }
  | { kind: 'missing' }
  | { kind: 'masked' }
  | { kind: 'unresolvable'; source: string };

export const authoredSource = (
  shape: Pick<StoryShape, 'members' | 'metaMembers'>,
  ctx: ReferenceContext
): AuthoredSource => {
  for (const members of [shape.members, shape.metaMembers]) {
    const code = memberAt(members, ['parameters', 'docs', 'source', 'code'], ctx);
    if (code.kind === 'missing') {
      continue;
    }
    if (code.kind === 'masked') {
      return { kind: 'missing' };
    }
    if (code.kind === 'unresolvable') {
      return code;
    }

    const resolved = resolveArgValue(code.node, ctx);
    const value = unwrapExpression(resolved.node);
    if (isUndefined(value)) {
      continue;
    }
    if (
      value.type === 'Literal' &&
      value.value === null &&
      !('regex' in value || 'bigint' in value)
    ) {
      return { kind: 'disabled' };
    }
    if (isStringLiteral(value)) {
      return { kind: 'code', code: value.value };
    }
    const parts = templateParts(value);
    if (parts && parts.expressions.length === 0) {
      return { kind: 'code', code: parts.quasis[0] ?? '' };
    }
    return { kind: 'unresolvable', source: sourceOf(code.node) };
  }
  return { kind: 'missing' };
};

const memberAt = (
  members: ResolvedMembers,
  path: readonly [string, ...string[]],
  ctx: ReferenceContext
): MemberPathResolution => {
  let result = memberOf(members, path[0]);

  for (const [depth, key] of path.slice(1).entries()) {
    if (result.kind !== 'value') {
      return result;
    }
    const original = result.node;
    const object = unwrapExpression(resolveArgValue(original, ctx).node);
    if (object.type !== 'ObjectExpression') {
      if (isUndefined(object)) {
        return { kind: 'missing' };
      }
      if (isOpaqueValue(object)) {
        return { kind: 'unresolvable', source: sourceOf(original) };
      }
      return depth === 0 ? { kind: 'missing' } : { kind: 'masked' };
    }
    result = memberOf(resolveObjectMembers(object, ctx), key);
  }

  return result;
};

const memberOf = (members: ResolvedMembers, key: string): MemberPathResolution => {
  const node = members.properties[key];
  if (node !== undefined && !members.shadowed.includes(key)) {
    return { kind: 'value', node };
  }
  if (members.unresolved.length > 0) {
    return { kind: 'unresolvable', source: members.unresolved.at(-1)! };
  }
  return { kind: 'missing' };
};

const isUndefined = (node: Node): boolean =>
  (node.type === 'Identifier' && node.name === 'undefined') ||
  (node.type === 'UnaryExpression' && node.operator === 'void');

const isOpaqueValue = (node: Node): boolean =>
  node.type !== 'Literal' &&
  node.type !== 'TemplateLiteral' &&
  node.type !== 'ArrayExpression' &&
  node.type !== 'ArrowFunctionExpression' &&
  node.type !== 'FunctionExpression' &&
  node.type !== 'FunctionDeclaration' &&
  !(node.type === 'Property' && node.method);
