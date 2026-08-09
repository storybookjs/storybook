import type * as ts from 'typescript';

import type { Property } from '@storybook/angular-compodoc';
import type { AnalyzerContext } from './context.ts';
import type { ClassMembers, MemberEntry } from './members.ts';
import { applyMetadataInputsOutputs, memberKey, visitClassMembers } from './members.ts';

type IOBucket = 'inputs' | 'outputs';

/**
 * Fold every base class's members into `members`.
 *
 * Angular merges a base definition into a subclass by class field, so identity here is the declared
 * field rather than the public name an alias may have replaced.
 */
export function mergeInheritedMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers
): void {
  walkBases(ctx, classNode, members, new Set([classNode]));
}

function walkBases(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers,
  visited: Set<ts.Node>
): void {
  if (!classNode.name) {
    return;
  }
  const symbol = ctx.checker.getSymbolAtLocation(classNode.name);
  const type = symbol && ctx.checker.getDeclaredTypeOfSymbol(symbol);
  if (!type?.isClassOrInterface()) {
    return;
  }
  for (const baseType of ctx.checker.getBaseTypes(type)) {
    const declaration = baseType
      .getSymbol()
      ?.declarations?.find((candidate): candidate is ts.ClassDeclaration =>
        ctx.ts.isClassDeclaration(candidate)
      );
    if (!declaration || visited.has(declaration)) {
      continue;
    }
    visited.add(declaration);
    const baseMembers = visitClassMembers(ctx, declaration);
    // A base carries its own `@Directive({ inputs })`, and nothing downstream would reclassify
    // those fields once they have been merged in as plain properties.
    applyMetadataInputsOutputs(ctx, declaration, baseMembers);
    // A declaration file records no decorators or signal calls, so a base from one has nothing to
    // contribute to the IO buckets.
    if (!declaration.getSourceFile().isDeclarationFile) {
      mergeBucket(members, baseMembers, 'inputs');
      mergeBucket(members, baseMembers, 'outputs');
    }
    mergeInto(members.properties, baseMembers.properties, members);
    mergeInto(members.methods, baseMembers.methods, members);
    walkBases(ctx, declaration, members, visited);
  }
}

/**
 * Merge one IO bucket, promoting a child's plain re-declaration into it.
 *
 * Re-declaring an inherited `@Input()` without repeating the decorator does not un-input it in
 * Angular, so the child's own shape wins while the base decides the bucket.
 */
function mergeBucket(members: ClassMembers, baseMembers: ClassMembers, bucket: IOBucket): void {
  for (const inherited of baseMembers[bucket]) {
    const key = memberKey(inherited);
    // The opposite IO bucket is deliberately not consulted: a base's `model()` is one entry in
    // both, and each half has to survive independently.
    const owned = [members[bucket], members.methods].some((entries) =>
      entries.some((entry) => memberKey(entry) === key)
    );
    if (owned) {
      continue;
    }
    const index = members.properties.findIndex((entry) => memberKey(entry) === key);
    if (index < 0) {
      members[bucket].push(inherited);
      continue;
    }
    const [own] = members.properties.splice(index, 1);
    members[bucket].push(promote(own, inherited));
  }
}

/**
 * Keep the child's own metadata but adopt the base's public name, which is what a template binds
 * when the child does not re-alias the field.
 */
const promote = (
  own: MemberEntry<Property>,
  inherited: MemberEntry<Property>
): MemberEntry<Property> => ({
  ...own,
  value: { ...own.value, name: inherited.value.name },
});

const claimedElsewhere = (members: ClassMembers, key: string): boolean =>
  [members.inputs, members.outputs, members.properties, members.methods].some((bucket) =>
    bucket.some((entry) => memberKey(entry) === key)
  );

function mergeInto<T>(
  target: MemberEntry<T>[],
  source: MemberEntry<T>[],
  members: ClassMembers
): void {
  for (const inherited of source) {
    if (!claimedElsewhere(members, memberKey(inherited))) {
      target.push(inherited);
    }
  }
}
