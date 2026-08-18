import type * as ts from 'typescript';

import type { PropertyInitializer } from '../types.ts';
import { resolvedSymbol, type AnalyzerContext } from './context.ts';

type LiteralKind = Extract<PropertyInitializer, { kind: 'literal' }>['literalKind'];

const unwrapInitializer = (ts: typeof import('typescript'), expression: ts.Expression) => {
  let unwrapped = expression;
  while (
    ts.isParenthesizedExpression(unwrapped) ||
    ts.isAsExpression(unwrapped) ||
    ts.isSatisfiesExpression(unwrapped) ||
    ts.isTypeAssertionExpression(unwrapped) ||
    ts.isNonNullExpression(unwrapped)
  ) {
    unwrapped = unwrapped.expression;
  }
  return unwrapped;
};

const isEnumMemberAccess = (
  ctx: AnalyzerContext,
  expression: ts.PropertyAccessExpression
): boolean => {
  const resolved = resolvedSymbol(ctx, expression.name);
  return Boolean(resolved && resolved.flags & ctx.ts.SymbolFlags.EnumMember);
};

const literalKind = (ctx: AnalyzerContext, expression: ts.Expression): LiteralKind | undefined => {
  const { ts } = ctx;
  const value = unwrapInitializer(ts, expression);

  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
    return 'string';
  }
  if (ts.isNumericLiteral(value)) {
    return 'number';
  }
  if (ts.isBigIntLiteral(value)) {
    return 'bigint';
  }
  if (value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword) {
    return 'boolean';
  }
  if (value.kind === ts.SyntaxKind.NullKeyword) {
    return 'null';
  }
  if (
    ts.isIdentifier(value) &&
    value.text === 'undefined' &&
    ctx.checker.getTypeAtLocation(value).flags & ts.TypeFlags.Undefined
  ) {
    const symbol = ctx.checker.getSymbolAtLocation(value);
    if (!symbol?.valueDeclaration && (symbol?.declarations?.length ?? 0) === 0) {
      return 'undefined';
    }
  }
  if (ts.isPrefixUnaryExpression(value)) {
    if (
      (value.operator === ts.SyntaxKind.PlusToken || value.operator === ts.SyntaxKind.MinusToken) &&
      ts.isNumericLiteral(value.operand)
    ) {
      return 'number';
    }
    if (value.operator === ts.SyntaxKind.MinusToken && ts.isBigIntLiteral(value.operand)) {
      return 'bigint';
    }
    return undefined;
  }
  if (ts.isPropertyAccessExpression(value)) {
    return isEnumMemberAccess(ctx, value) ? 'enum' : undefined;
  }
  if (ts.isArrayLiteralExpression(value)) {
    return value.elements.every(
      (element) =>
        !ts.isSpreadElement(element) &&
        !ts.isOmittedExpression(element) &&
        literalKind(ctx, element) !== undefined
    )
      ? 'composite'
      : undefined;
  }
  if (ts.isObjectLiteralExpression(value)) {
    return value.properties.every(
      (property) =>
        ts.isPropertyAssignment(property) &&
        !ts.isComputedPropertyName(property.name) &&
        literalKind(ctx, property.initializer) !== undefined
    )
      ? 'composite'
      : undefined;
  }
  return undefined;
};

export const defaultInitializer = (
  ctx: AnalyzerContext,
  expression: ts.Expression
): PropertyInitializer => {
  const unwrapped = unwrapInitializer(ctx.ts, expression);
  const kind = literalKind(ctx, unwrapped);
  return kind
    ? { kind: 'literal', literalKind: kind, text: unwrapped.getText() }
    : { kind: 'expression', text: expression.getText() };
};
