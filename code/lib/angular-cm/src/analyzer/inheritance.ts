import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';
import type { ClassMembers } from './members.ts';
import { visitClassMembers } from './members.ts';

/**
 * Appends base-class members the child does not already declare. A name declared by the child (or
 * a nearer base) in ANY bucket blocks that name in EVERY bucket: Angular inherits input metadata,
 * so a child re-declaring an inherited `@Input()` as a plain property must not also surface the
 * base's input entry (whose defaultValue would shadow the child's). Bases are resolved through the
 * checker, so cross-file and even `node_modules` ancestors work - the latter contribute
 * best-effort plain properties/methods only, since a declaration file carries no decorator or
 * signal information.
 */
export function mergeInheritedMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers
): void {
  const claimed = new Set(
    [...members.inputs, ...members.outputs, ...members.properties, ...members.methods].map(
      (member) => member.name
    )
  );
  walkBases(ctx, classNode, members, claimed, new Set([classNode]));
}

function walkBases(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers,
  claimed: Set<string>,
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
    // Names are claimed only after the whole base is merged, so a model()'s paired input and
    // output entries (same name, same class) both survive.
    const appended = new Set<string>();
    const merge = <T extends { name: string }>(target: T[], source: T[]) => {
      for (const entry of source) {
        if (!claimed.has(entry.name)) {
          target.push(entry);
          appended.add(entry.name);
        }
      }
    };
    // A declaration file records no decorators or signal calls, so a base from one has nothing to
    // contribute to the IO buckets.
    if (!declaration.getSourceFile().isDeclarationFile) {
      merge(members.inputs, baseMembers.inputs);
      merge(members.outputs, baseMembers.outputs);
    }
    merge(members.properties, baseMembers.properties);
    merge(members.methods, baseMembers.methods);
    for (const name of appended) {
      claimed.add(name);
    }
    walkBases(ctx, declaration, members, claimed, visited);
  }
}
