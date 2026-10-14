import type * as ts from 'typescript';

import { resolvedSymbol, type AnalyzerContext } from './context.ts';
import { isDeclaredInAngularCore } from './decorators.ts';

export interface ComponentMetadata {
  selector: string | undefined;
  standalone: boolean | undefined;
}

// Angular 12-13 emit seven type arguments; Angular 14 introduced standalone as the eighth.
const PRE_STANDALONE_ARGUMENT_COUNT = 7;

// A published library's `.d.ts` keeps a class's `@Component` only as this compiled `ɵcmp` type.
export const readComponentDeclaration = (
  ctx: AnalyzerContext,
  classNode: ts.ClassDeclaration
): ComponentMetadata | undefined => {
  if (!classNode.getSourceFile().isDeclarationFile) {
    return undefined;
  }
  const type = staticCmpType(ctx, classNode);
  const typeArguments = type?.typeArguments;
  if (
    !type ||
    !typeArguments ||
    typeArguments.length < PRE_STANDALONE_ARGUMENT_COUNT ||
    !isAngularComponentDeclaration(ctx, type.typeName) ||
    !referencesClass(ctx, typeArguments[0], classNode)
  ) {
    return undefined;
  }
  const standaloneArgument = typeArguments[PRE_STANDALONE_ARGUMENT_COUNT];
  return {
    selector: selectorArgument(ctx, typeArguments[1]),
    standalone: standaloneArgument ? booleanArgument(ctx, standaloneArgument) : false,
  };
};

const staticCmpType = (
  { ts }: AnalyzerContext,
  classNode: ts.ClassDeclaration
): ts.TypeReferenceNode | undefined => {
  for (const member of classNode.members) {
    if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === 'ɵcmp' &&
      ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword) &&
      member.type &&
      ts.isTypeReferenceNode(member.type)
    ) {
      return member.type;
    }
  }
  return undefined;
};

const entityIdentifier = ({ ts }: AnalyzerContext, name: ts.EntityName): ts.Identifier =>
  ts.isQualifiedName(name) ? name.right : name;

const isAngularComponentDeclaration = (ctx: AnalyzerContext, typeName: ts.EntityName): boolean => {
  const symbol = resolvedSymbol(ctx, entityIdentifier(ctx, typeName));
  return symbol?.name === 'ɵɵComponentDeclaration' && isDeclaredInAngularCore(symbol);
};

const referencesClass = (
  ctx: AnalyzerContext,
  argument: ts.TypeNode,
  classNode: ts.ClassDeclaration
): boolean => {
  if (!ctx.ts.isTypeReferenceNode(argument) || !classNode.name) {
    return false;
  }
  const classSymbol = ctx.checker.getSymbolAtLocation(classNode.name);
  return (
    classSymbol !== undefined &&
    resolvedSymbol(ctx, entityIdentifier(ctx, argument.typeName)) === classSymbol
  );
};

const selectorArgument = ({ ts }: AnalyzerContext, argument: ts.TypeNode): string | undefined =>
  ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)
    ? argument.literal.text
    : undefined;

const booleanArgument = ({ ts }: AnalyzerContext, argument: ts.TypeNode): boolean | undefined => {
  if (!ts.isLiteralTypeNode(argument)) {
    return undefined;
  }
  if (argument.literal.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  return argument.literal.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
};
