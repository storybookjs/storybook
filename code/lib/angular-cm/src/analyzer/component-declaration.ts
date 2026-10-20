import type * as ts from 'typescript';

import { resolvedSymbol, type AnalyzerContext } from './context.ts';
import { isDeclaredInAngularCore, type MetadataIOEntry } from './decorators.ts';

export interface ComponentMetadata {
  selector: string | undefined;
  standalone: boolean | undefined;
}

export interface ComponentDeclaration extends ComponentMetadata {
  inputsOutputs: MetadataIOEntry[];
}

// Angular 12-13 emit seven type arguments; Angular 14 introduced standalone as the eighth.
const PRE_STANDALONE_ARGUMENT_COUNT = 7;

// A published library's `.d.ts` keeps a class's `@Component` only as this compiled `ɵcmp` type.
export const readComponentDeclaration = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration
): ComponentDeclaration | undefined => {
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
    selector: stringLiteral(ctx, typeArguments[1]),
    standalone: standaloneArgument ? booleanArgument(ctx, standaloneArgument) : false,
    inputsOutputs: [
      ...ioMapEntries(ctx, typeArguments[3], 'inputs'),
      ...ioMapEntries(ctx, typeArguments[4], 'outputs'),
    ],
  };
};

const staticCmpType = (
  { ts }: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration
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
  classNode: ts.ClassLikeDeclaration
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

const booleanArgument = ({ ts }: AnalyzerContext, argument: ts.TypeNode): boolean | undefined => {
  if (!ts.isLiteralTypeNode(argument)) {
    return undefined;
  }
  if (argument.literal.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  return argument.literal.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
};

// Keyed by class field. An entry is the public name, or since Angular 16 an object type such as
// `{ alias: 'label'; required: false }`.
const ioMapEntries = (
  ctx: AnalyzerContext,
  map: ts.TypeNode,
  bucket: MetadataIOEntry['bucket']
): MetadataIOEntry[] => {
  const { ts } = ctx;
  if (!ts.isTypeLiteralNode(map)) {
    return [];
  }
  const entries: MetadataIOEntry[] = [];
  for (const member of map.members) {
    const name = member.name && propertyNameText(ctx, member.name);
    const value = ts.isPropertySignature(member) ? member.type : undefined;
    if (!name || !value) {
      continue;
    }
    const alias = ts.isTypeLiteralNode(value)
      ? stringLiteral(ctx, objectTypeMember(ctx, value, 'alias'))
      : stringLiteral(ctx, value);
    const required = ts.isTypeLiteralNode(value)
      ? booleanLiteral(ctx, objectTypeMember(ctx, value, 'required'))
      : undefined;
    entries.push({
      bucket,
      name,
      ...(alias === undefined || alias === name ? {} : { alias }),
      ...(required === undefined ? {} : { required }),
    });
  }
  return entries;
};

const propertyNameText = ({ ts }: AnalyzerContext, name: ts.PropertyName): string | undefined =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;

const objectTypeMember = (
  ctx: AnalyzerContext,
  object: ts.TypeLiteralNode,
  key: string
): ts.TypeNode | undefined =>
  object.members.find(
    (member): member is ts.PropertySignature =>
      ctx.ts.isPropertySignature(member) && propertyNameText(ctx, member.name) === key
  )?.type;

const stringLiteral = ({ ts }: AnalyzerContext, node: ts.TypeNode | undefined) =>
  node && ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)
    ? node.literal.text
    : undefined;

const booleanLiteral = (ctx: AnalyzerContext, node: ts.TypeNode | undefined) =>
  node ? booleanArgument(ctx, node) : undefined;
