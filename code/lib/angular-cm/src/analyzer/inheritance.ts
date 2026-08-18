import type * as ts from 'typescript';

import type { Property } from '../types.ts';
import type { AnalyzerContext } from './context.ts';
import type { ClassMembers, MemberEntry } from './members.ts';
import { applyMetadataInputsOutputs, visitClassMembers } from './members.ts';

type IOBucket = 'inputs' | 'outputs';

/**
 * Resolve one class's members, every base folded in.
 *
 * Angular merges a base definition into a subclass by class field, so identity here is the declared
 * field rather than the public name an alias may have replaced.
 *
 * The class's own `@Directive({ inputs })` runs last, once the bases are merged, because it can name
 * a field an ancestor declared. Recursing through here rather than exporting the passes separately
 * is what keeps that order from being something a caller has to remember.
 */
export function resolveClassMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  visited: Set<ts.Node> = new Set([classNode])
): ClassMembers {
  const members = visitClassMembers(ctx, classNode);
  walkBases(ctx, classNode, members, visited);
  applyMetadataInputsOutputs(ctx, classNode, members);
  return members;
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
    const baseMembers = resolveClassMembers(ctx, declaration, visited);
    substituteInherited(baseMembers, typeParameterSubstitutions(ctx, classNode, declaration));
    // A declaration file records no decorators or signal calls, so a base from one has nothing to
    // contribute to the IO buckets.
    if (!declaration.getSourceFile().isDeclarationFile) {
      mergeBucket(members, baseMembers, 'inputs');
      mergeBucket(members, baseMembers, 'outputs');
    }
    mergeInto(members.properties, baseMembers.properties, members);
    mergeInto(members.methods, baseMembers.methods, members);
  }
}

// Only a clause naming the base itself can be mapped positionally onto its type parameters; a
// mixin call in the extends position resolves to a base this cannot see through.
const extendsClauseFor = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  declaration: ts.ClassDeclaration
): ts.ExpressionWithTypeArguments | undefined => {
  const { ts, checker } = ctx;
  const clause = classNode.heritageClauses?.find(
    (candidate) => candidate.token === ts.SyntaxKind.ExtendsKeyword
  );
  const expression = clause?.types[0];
  const target = expression?.expression;
  if (!target || (!ts.isIdentifier(target) && !ts.isPropertyAccessExpression(target))) {
    return undefined;
  }
  const symbol = checker.getSymbolAtLocation(target);
  const resolved =
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return resolved?.declarations?.includes(declaration) ? expression : undefined;
};

// An argument the extends clause leaves out falls back to the parameter's default, itself
// substituted so a default referencing an earlier parameter resolves too.
const typeParameterSubstitutions = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  declaration: ts.ClassDeclaration
): Map<string, string> => {
  const substitutions = new Map<string, string>();
  const parameters = declaration.typeParameters ?? [];
  if (parameters.length === 0) {
    return substitutions;
  }
  const clause = extendsClauseFor(ctx, classNode, declaration);
  if (!clause) {
    return substitutions;
  }
  const args = clause.typeArguments ?? [];
  for (const [index, parameter] of parameters.entries()) {
    const argument = args[index] ?? parameter.default;
    if (!argument) {
      continue;
    }
    const rendered = ctx.types.render(argument);
    substitutions.set(
      parameter.name.text,
      args[index] ? rendered : substituteIdentifiers(rendered, substitutions)
    );
  }
  return substitutions;
};

// Quoted literals are matched only to be kept as they are: a `'T'` union member must not be
// rewritten when a type parameter happens to be named `T`.
const IDENTIFIER_OR_STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$]*/g;

const substituteIdentifiers = (text: string, substitutions: Map<string, string>): string =>
  text.replace(IDENTIFIER_OR_STRING, (token) =>
    token.startsWith('"') || token.startsWith("'") ? token : (substitutions.get(token) ?? token)
  );

const substituteInherited = (members: ClassMembers, substitutions: Map<string, string>): void => {
  if (substitutions.size === 0) {
    return;
  }
  // A model() is one Property in both IO buckets, and a swap-shaped map must not apply twice.
  const properties = new Set(
    [...members.inputs, ...members.outputs, ...members.properties].map((entry) => entry.value)
  );
  for (const property of properties) {
    if (property.type !== undefined) {
      property.type = substituteIdentifiers(property.type, substitutions);
    }
  }
  for (const { value: method } of members.methods) {
    method.returnType = substituteIdentifiers(method.returnType, substitutions);
    for (const argument of method.args) {
      argument.type = substituteIdentifiers(argument.type, substitutions);
    }
  }
};

/**
 * Merge one IO bucket, promoting a child's plain re-declaration into it.
 *
 * Re-declaring an inherited `@Input()` without repeating the decorator does not un-input it in
 * Angular, so the child's own shape wins while the base decides the bucket.
 */
function mergeBucket(members: ClassMembers, baseMembers: ClassMembers, bucket: IOBucket): void {
  for (const inherited of baseMembers[bucket]) {
    const key = inherited.declName;
    // The opposite IO bucket is deliberately not consulted: a base's `model()` is one entry in
    // both, and each half has to survive independently.
    const owned = [members[bucket], members.methods].some((entries) =>
      entries.some((entry) => entry.declName === key)
    );
    if (owned) {
      continue;
    }
    const index = members.properties.findIndex((entry) => entry.declName === key);
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
    bucket.some((entry) => entry.declName === key)
  );

function mergeInto<T>(
  target: MemberEntry<T>[],
  source: MemberEntry<T>[],
  members: ClassMembers
): void {
  for (const inherited of source) {
    if (!claimedElsewhere(members, inherited.declName)) {
      target.push(inherited);
    }
  }
}
