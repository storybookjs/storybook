import type * as ts from 'typescript';

import type { Property } from '../types.ts';
import type { AnalyzerContext } from './context.ts';
import { isAngularCoreOrUnresolved, stringOption } from './decorators.ts';
import { getJsDocDescription, getJsDocTagsField } from './jsdoc.ts';
import { initializerText, memberName } from './node-text.ts';
import { stripImportQualifiers } from './type-index.ts';

const SIGNAL_INPUT_NAMES = new Set(['input', 'model']);
const SIGNAL_NAMES = new Set(['input', 'output', 'model']);
const SIGNAL_TYPE_NAMES = new Set([
  'InputSignal',
  'InputSignalWithTransform',
  'ModelSignal',
  'OutputEmitterRef',
]);

interface SignalCall {
  kind: 'input' | 'output' | 'model';
  required: boolean;
  call: ts.CallExpression;
}

export const parseSignalCall = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration
): SignalCall | undefined => {
  const { ts } = ctx;
  // Angular only recognizes signal IO on instance fields.
  if (ts.getModifiers(member)?.some((modifier) => modifier.kind === ts.SyntaxKind.StaticKeyword)) {
    return undefined;
  }
  const initializer = member.initializer;
  if (!initializer || !ts.isCallExpression(initializer)) {
    return undefined;
  }
  const callee = initializer.expression;
  let base: ts.Identifier;
  let required = false;
  if (ts.isIdentifier(callee) && SIGNAL_NAMES.has(callee.text)) {
    base = callee;
  } else if (
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === 'required' &&
    ts.isIdentifier(callee.expression) &&
    SIGNAL_INPUT_NAMES.has(callee.expression.text)
  ) {
    base = callee.expression;
    required = true;
  } else {
    return undefined;
  }
  if (!isAngularCoreOrUnresolved(ctx, base)) {
    return undefined;
  }
  return { kind: base.text as SignalCall['kind'], required, call: initializer };
};

export const buildSignalEntry = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  signal: SignalCall
): Property => {
  const { ts } = ctx;
  const { call } = signal;
  // `input.required(opts?)`, `model.required(opts?)` and `output(opts?)` take only options; the
  // non-required input/model variants take the default value first, options second.
  const hasValueArgument = !signal.required && signal.kind !== 'output';
  const valueArgument = hasValueArgument ? call.arguments[0] : undefined;
  const optionsArgument = hasValueArgument ? call.arguments[1] : call.arguments[0];
  const alias =
    optionsArgument && ts.isObjectLiteralExpression(optionsArgument)
      ? stringOption(ctx, optionsArgument, 'alias')
      : undefined;
  const type =
    (call.typeArguments?.[0] ? ctx.types.render(call.typeArguments[0]) : undefined) ??
    signalValueTypeFromChecker(ctx, member) ??
    (valueArgument ? literalTypeName(ctx, valueArgument) : undefined);
  return {
    name: alias ?? memberName(ctx.ts, member.name),
    ...(type === undefined ? {} : { type }),
    optional: false,
    required: signal.required,
    // Downstream tells a `model()` apart from an `@Input('x')`/`@Output('x')` alias collision by
    // the same name appearing in both arrays on the same declaration line.
    line: ts.getLineAndCharacterOfPosition(member.getSourceFile(), member.getStart()).line + 1,
    ...(valueArgument ? { defaultValue: initializerText(ctx.ts, valueArgument) } : {}),
    ...getJsDocDescription(ts, member),
    ...getJsDocTagsField(ts, member),
  };
};

const signalValueTypeFromChecker = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration
): string | undefined => {
  const { checker, ts } = ctx;
  const type = checker.getTypeAtLocation(member);
  const symbolName = type.aliasSymbol?.name ?? type.getSymbol()?.name;
  if (!symbolName || !SIGNAL_TYPE_NAMES.has(symbolName)) {
    return undefined;
  }
  const isReference =
    !!(type.flags & ts.TypeFlags.Object) &&
    !!((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference);
  if (!isReference) {
    return undefined;
  }
  const valueType = checker.getTypeArguments(type as ts.TypeReference)[0];
  if (!valueType) {
    return undefined;
  }
  // Widen a lone literal (`model('x' as const)` → string) but keep literal unions: their quoted
  // spelling (`"left" | "right"`) is what feeds the extractor's enum path.
  const widened = valueType.isUnion() ? valueType : checker.getBaseTypeOfLiteralType(valueType);
  ctx.types.addFromType(widened);
  // Stripped because `addFromType` files the alias under its bare name, and the extractor matches
  // `miscellaneous` entries by exact string equality.
  return stripImportQualifiers(
    checker.typeToString(widened, member, ts.TypeFormatFlags.NoTruncation)
  );
};

const literalTypeName = (ctx: AnalyzerContext, expression: ts.Expression): string | undefined => {
  const { ts } = ctx;
  if (ts.isStringLiteralLike(expression)) {
    return 'string';
  }
  if (ts.isNumericLiteral(expression)) {
    return 'number';
  }
  if (
    expression.kind === ts.SyntaxKind.TrueKeyword ||
    expression.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return 'boolean';
  }
  return undefined;
};
