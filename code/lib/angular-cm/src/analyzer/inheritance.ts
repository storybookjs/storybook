import type * as ts from 'typescript';

import type { Method, Property } from '../types.ts';
import { resolvedSymbol, type AnalyzerContext } from './context.ts';
import type { ClassMembers, DocumentedClassKind, MemberEntry } from './members.ts';
import { applyMetadataInputsOutputs, sameMemberIdentity, visitClassMembers } from './members.ts';
import { signalValueTypeFromType } from './signals.ts';

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
  kind: DocumentedClassKind
): ClassMembers {
  return resolveWithBases(ctx, classNode, kind, new Set([classNode]), new Map());
}

function resolveWithBases(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  kind: DocumentedClassKind,
  visited: Set<ts.Node>,
  substitutions: ReadonlyMap<ts.Symbol, ts.TypeNode>,
  instantiatedType?: ts.Type
): ClassMembers {
  const members = visitClassMembers(ctx, classNode, kind);
  walkBases(ctx, classNode, members, kind, visited, substitutions);
  applyMetadataInputsOutputs(ctx, classNode, members);
  if (instantiatedType) {
    instantiateMembers(ctx, instantiatedType, classNode, members, substitutions);
  }
  return members;
}

function walkBases(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers,
  kind: DocumentedClassKind,
  visited: Set<ts.Node>,
  substitutions: ReadonlyMap<ts.Symbol, ts.TypeNode>
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
    const inheritedSubstitutions = new Map(substitutions);
    for (const [parameter, argument] of typeParameterSubstitutions(ctx, classNode, declaration)) {
      inheritedSubstitutions.set(parameter, argument);
    }
    const baseMembers = resolveWithBases(
      ctx,
      declaration,
      kind,
      visited,
      inheritedSubstitutions,
      baseType
    );
    // A declaration file records no decorators or signal calls, so a base from one has nothing to
    // contribute to the IO buckets.
    if (!declaration.getSourceFile().isDeclarationFile) {
      mergeBucket(ctx, members, baseMembers, 'inputs');
      mergeBucket(ctx, members, baseMembers, 'outputs');
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
  const { ts } = ctx;
  const clause = classNode.heritageClauses?.find(
    (candidate) => candidate.token === ts.SyntaxKind.ExtendsKeyword
  );
  const expression = clause?.types[0];
  const target = expression?.expression;
  if (!target || (!ts.isIdentifier(target) && !ts.isPropertyAccessExpression(target))) {
    return undefined;
  }
  const resolved = resolvedSymbol(ctx, target);
  return resolved?.declarations?.includes(declaration) ? expression : undefined;
};

// An argument the extends clause leaves out falls back to the parameter's default, itself
// substituted so a default referencing an earlier parameter resolves too.
const typeParameterSubstitutions = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  declaration: ts.ClassDeclaration
): Map<ts.Symbol, ts.TypeNode> => {
  const substitutions = new Map<ts.Symbol, ts.TypeNode>();
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
    const symbol = ctx.checker.getSymbolAtLocation(parameter.name);
    if (!argument || !symbol) {
      continue;
    }
    substitutions.set(symbol, argument);
  }
  return substitutions;
};

const declaredIn = (
  ctx: AnalyzerContext,
  entry: MemberEntry<unknown>,
  classNode: ts.ClassLikeDeclaration
): boolean => {
  let node: ts.Node | undefined = entry.declaration;
  while (node && !ctx.ts.isClassLike(node)) {
    node = node.parent;
  }
  return node === classNode;
};

const instantiateMembers = (
  ctx: AnalyzerContext,
  instantiatedType: ts.Type,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers,
  substitutions: ReadonlyMap<ts.Symbol, ts.TypeNode>
): void => {
  if (substitutions.size === 0) {
    return;
  }
  const properties = new Set([...members.inputs, ...members.outputs, ...members.properties]);
  for (const entry of properties) {
    instantiateProperty(ctx, instantiatedType, classNode, entry, substitutions);
  }
  for (const entry of members.methods) {
    instantiateMethod(ctx, instantiatedType, classNode, entry, substitutions);
  }
};

const instantiateProperty = (
  ctx: AnalyzerContext,
  instantiatedType: ts.Type,
  classNode: ts.ClassLikeDeclaration,
  entry: MemberEntry<Property>,
  substitutions: ReadonlyMap<ts.Symbol, ts.TypeNode>
): void => {
  if (entry.isStatic) {
    return;
  }
  if (entry.typeSource?.kind === 'transform') {
    const checkerTypeSymbol = entry.typeSource.checkerType.getSymbol();
    const checkerReplacement =
      entry.typeSource.checkerType.flags & ctx.ts.TypeFlags.TypeParameter && checkerTypeSymbol
        ? substitutions.get(checkerTypeSymbol)
        : undefined;
    if (checkerReplacement) {
      entry.value.type = ctx.types.renderInstantiated(checkerReplacement, substitutions);
      return;
    }
    if (entry.typeSource.node && declaredIn(ctx, entry, classNode)) {
      const transformSubstitutions = new Map(entry.typeSource.substitutions);
      for (const [symbol, replacement] of substitutions) {
        transformSubstitutions.set(symbol, replacement);
      }
      entry.value.type = ctx.types.renderInstantiated(
        entry.typeSource.node,
        transformSubstitutions
      );
    }
    return;
  }
  if (
    ctx.ts.isPropertyDeclaration(entry.declaration) &&
    !entry.declaration.type &&
    entry.declaration.initializer &&
    ctx.ts.isNewExpression(entry.declaration.initializer)
  ) {
    return;
  }
  if (entry.typeSource?.kind !== 'signal') {
    const typeNode = declaredPropertyTypeNode(ctx, entry.declaration);
    if (typeNode) {
      if (declaredIn(ctx, entry, classNode)) {
        entry.value.type = ctx.types.renderInstantiated(typeNode, substitutions);
      }
      return;
    }
  }
  const type = propertyType(ctx, instantiatedType, entry);
  if (!type) {
    return;
  }
  const rendered = entry.typeSource
    ? signalValueTypeFromType(ctx, type, entry.declaration)
    : ctx.types.renderCheckerType(type, entry.declaration);
  if (rendered !== undefined) {
    entry.value.type = rendered;
  }
};

const propertyType = (
  ctx: AnalyzerContext,
  instantiatedType: ts.Type,
  entry: MemberEntry<unknown>
): ts.Type | undefined => {
  const declarationSymbol = entry.declaration.name
    ? ctx.checker.getSymbolAtLocation(entry.declaration.name)
    : undefined;
  const symbol =
    instantiatedType
      .getProperties()
      .find(
        (candidate) =>
          candidate === declarationSymbol || candidate.declarations?.includes(entry.declaration)
      ) ?? ctx.checker.getPropertyOfType(instantiatedType, entry.declName);
  return symbol && ctx.checker.getTypeOfSymbolAtLocation(symbol, entry.declaration);
};

const declaredPropertyTypeNode = (
  ctx: AnalyzerContext,
  declaration: ts.NamedDeclaration
): ts.TypeNode | undefined => {
  if (ctx.ts.isPropertyDeclaration(declaration) || ctx.ts.isParameter(declaration)) {
    return declaration.type;
  }
  if (ctx.ts.isGetAccessorDeclaration(declaration)) {
    return declaration.type;
  }
  if (ctx.ts.isSetAccessorDeclaration(declaration)) {
    return declaration.parameters[0]?.type;
  }
  return undefined;
};

const instantiateMethod = (
  ctx: AnalyzerContext,
  instantiatedType: ts.Type,
  classNode: ts.ClassLikeDeclaration,
  entry: MemberEntry<Method>,
  substitutions: ReadonlyMap<ts.Symbol, ts.TypeNode>
): void => {
  if (entry.isStatic) {
    return;
  }
  const type = propertyType(ctx, instantiatedType, entry);
  const signatures = type?.getCallSignatures() ?? [];
  const signature = signatures.length === 1 ? signatures[0] : undefined;
  const declaredHere = declaredIn(ctx, entry, classNode);
  if (ctx.ts.isMethodDeclaration(entry.declaration)) {
    const parameters = entry.declaration.parameters.filter(
      (parameter) => !ctx.ts.isIdentifier(parameter.name) || parameter.name.text !== 'this'
    );
    for (const [index, argument] of entry.value.args.entries()) {
      const declaredType = parameters[index]?.type;
      if (declaredType) {
        if (declaredHere) {
          argument.type = ctx.types.renderInstantiated(declaredType, substitutions);
        }
      } else {
        const parameter = signature?.getParameters()[index];
        if (!parameter) {
          continue;
        }
        argument.type = ctx.types.renderCheckerType(
          ctx.checker.getTypeOfSymbolAtLocation(parameter, entry.declaration),
          entry.declaration
        );
      }
    }
    if (entry.declaration.type) {
      if (declaredHere) {
        entry.value.returnType = ctx.types.renderInstantiated(
          entry.declaration.type,
          substitutions
        );
      }
    } else if (signature) {
      entry.value.returnType = ctx.types.renderCheckerType(
        signature.getReturnType(),
        entry.declaration
      );
    }
  }
};

/**
 * Merge one IO bucket, promoting a child's plain re-declaration into it.
 *
 * Re-declaring an inherited `@Input()` without repeating the decorator does not un-input it in
 * Angular, so the child's own shape wins while the base decides the bucket.
 */
function mergeBucket(
  ctx: AnalyzerContext,
  members: ClassMembers,
  baseMembers: ClassMembers,
  bucket: IOBucket
): void {
  for (const inherited of baseMembers[bucket]) {
    // The opposite IO bucket is deliberately not consulted: a base's `model()` is one entry in
    // both, and each half has to survive independently.
    const owned = [members[bucket], members.methods].some((entries) =>
      entries.some((entry) => sameMemberIdentity(entry, inherited))
    );
    if (owned) {
      continue;
    }
    const index = members.properties.findIndex((entry) => sameMemberIdentity(entry, inherited));
    if (index < 0) {
      members[bucket].push(inherited);
      continue;
    }
    const [own] = members.properties.splice(index, 1);
    const inheritedModel =
      inherited.typeSource?.kind === 'signal' && inherited.typeSource.signalKind === 'model';
    const typeOnlyRedeclaration = (
      ctx.ts.getModifiers(own.declaration as ts.HasModifiers) ?? []
    ).some((modifier) => modifier.kind === ctx.ts.SyntaxKind.DeclareKeyword);
    members[bucket].push(promote(own, inherited, inheritedModel && typeOnlyRedeclaration));
  }
}

/**
 * Keep the child's own metadata but adopt the base's public name, which is what a template binds
 * when the child does not re-alias the field.
 */
const promote = (
  own: MemberEntry<Property>,
  inherited: MemberEntry<Property>,
  preserveInheritedSignal: boolean
): MemberEntry<Property> => {
  if (!preserveInheritedSignal) {
    return {
      ...own,
      value: {
        ...own.value,
        name: inherited.value.name,
        ...(inherited.value.line === undefined ? {} : { line: inherited.value.line }),
      },
    };
  }
  return {
    ...own,
    ...(inherited.typeSource ? { typeSource: inherited.typeSource } : {}),
    value: {
      ...inherited.value,
      ...(own.value.decorators ? { decorators: own.value.decorators } : {}),
      ...(own.value.visibility ? { visibility: own.value.visibility } : {}),
      ...(own.value.internal ? { internal: own.value.internal } : {}),
      ...(own.value.description ? { description: own.value.description } : {}),
      ...(own.value.rawdescription ? { rawdescription: own.value.rawdescription } : {}),
      ...(own.value.jsdoctags ? { jsdoctags: own.value.jsdoctags } : {}),
    },
  };
};

const claimedElsewhere = (members: ClassMembers, inherited: MemberEntry<unknown>): boolean =>
  [members.inputs, members.outputs, members.properties, members.methods].some((bucket) =>
    bucket.some((entry) => sameMemberIdentity(entry, inherited))
  );

function mergeInto<T>(
  target: MemberEntry<T>[],
  source: MemberEntry<T>[],
  members: ClassMembers
): void {
  for (const inherited of source) {
    if (!claimedElsewhere(members, inherited)) {
      target.push(inherited);
    }
  }
}
