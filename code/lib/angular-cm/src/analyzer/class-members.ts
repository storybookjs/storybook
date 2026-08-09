import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';
import { mergeInheritedMembers } from './inheritance.ts';
import type { ClassMembers, MemberEntry } from './members.ts';
import { applyMetadataInputsOutputs, visitClassMembers } from './members.ts';

export type EmittedMembers = {
  [K in keyof ClassMembers]: ClassMembers[K][number]['value'][];
};

/**
 * Collect one class's members, base classes and decorator metadata included.
 *
 * The four passes are ordered and the order is not interchangeable: the merge seeds itself from
 * what the class declared, metadata can only reclassify a field once that field is present, and
 * sorting has to come after the pass that appends. Keeping them here, with the last two unexported,
 * is what stops a caller from running them out of turn.
 */
export function collectClassMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration
): EmittedMembers {
  const members = visitClassMembers(ctx, classNode);
  mergeInheritedMembers(ctx, classNode, members);
  applyMetadataInputsOutputs(ctx, classNode, members);
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

/** Drop the collection-only identity, leaving the arrays the compodoc record carries. */
function emitMembers(members: ClassMembers): EmittedMembers {
  const values = <T>(entries: MemberEntry<T>[]) => entries.map((entry) => entry.value);
  return {
    inputs: values(members.inputs),
    outputs: values(members.outputs),
    properties: values(members.properties),
    methods: values(members.methods),
  };
}
