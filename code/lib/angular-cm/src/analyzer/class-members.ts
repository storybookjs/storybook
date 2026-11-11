import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';
import { resolveClassMembers } from './inheritance.ts';
import type { ClassMembers, DocumentedClassKind, MemberEntry } from './members.ts';

export type EmittedMembers = {
  [K in keyof ClassMembers]: ClassMembers[K][number]['value'][];
};

/** Collect one class's members, base classes and decorator metadata included. */
export function collectClassMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  kind: DocumentedClassKind
): EmittedMembers {
  const members = resolveClassMembers(ctx, classNode, kind);
  sortMembers(members);
  return emitMembers(members);
}

function sortMembers(members: ClassMembers): void {
  const byName = (a: MemberEntry<{ name: string }>, b: MemberEntry<{ name: string }>) =>
    a.value.name.localeCompare(b.value.name);
  members.inputs.sort(byName);
  members.outputs.sort(byName);
  members.properties.sort(byName);
  members.methods.sort(byName);
}

/** Drop the collection-only identity, leaving the arrays the emitted record carries. */
function emitMembers(members: ClassMembers): EmittedMembers {
  const values = <T>(entries: MemberEntry<T>[]) => entries.map((entry) => entry.value);
  return {
    inputs: values(members.inputs),
    outputs: values(members.outputs),
    properties: values(members.properties),
    methods: values(members.methods),
  };
}
