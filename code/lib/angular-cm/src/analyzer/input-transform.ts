import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';

export type InputTransformSource = {
  kind: 'transform';
  checkerType: ts.Type;
  node?: ts.TypeNode;
  substitutions?: ReadonlyMap<ts.Symbol, ts.TypeNode>;
};

/**
 * Derive the template write type from an `@Input` transform's parameter.
 *
 * Return no transform for `unknown` or `any` parameters so the caller keeps the declared read type.
 */
export const analyzeInputTransform = (
  ctx: AnalyzerContext,
  transform: ts.Expression
): { type: string; source: InputTransformSource } | undefined => {
  const { checker, ts } = ctx;
  const signatures = checker.getTypeAtLocation(transform).getCallSignatures();
  // Angular's `TransformT` follows TypeScript inference from the last overload.
  const signature = signatures[signatures.length - 1];
  const parameter = signature?.getParameters()[0];
  const parameterType = parameter && checker.getTypeOfSymbolAtLocation(parameter, transform);
  if (!parameterType || parameterType.flags & (ts.TypeFlags.Unknown | ts.TypeFlags.Any)) {
    return undefined;
  }

  const declaration = parameter?.valueDeclaration;
  const node = declaration && ts.isParameter(declaration) ? declaration.type : undefined;
  let unwrappedTransform = transform;
  while (
    ts.isParenthesizedExpression(unwrappedTransform) ||
    ts.isSatisfiesExpression(unwrappedTransform) ||
    ts.isNonNullExpression(unwrappedTransform)
  ) {
    unwrappedTransform = unwrappedTransform.expression;
  }
  const typeArguments =
    ts.isCallExpression(unwrappedTransform) || ts.isExpressionWithTypeArguments(unwrappedTransform)
      ? unwrappedTransform.typeArguments
      : undefined;
  const substitutions = new Map<ts.Symbol, ts.TypeNode>();
  const genericSignature = ts.isCallExpression(unwrappedTransform)
    ? checker.getResolvedSignature(unwrappedTransform)
    : signature;
  const typeParameters = (genericSignature?.declaration?.typeParameters ?? []).filter(
    ts.isTypeParameterDeclaration
  );
  for (const [index, typeParameter] of typeParameters.entries()) {
    const symbol = checker.getSymbolAtLocation(typeParameter.name);
    const argument = typeArguments?.[index];
    if (symbol && argument) {
      substitutions.set(symbol, argument);
    }
  }

  return {
    type: ctx.types.renderValueType(parameterType, transform),
    source: {
      kind: 'transform',
      checkerType: parameterType,
      ...(node ? { node } : {}),
      ...(substitutions.size > 0 ? { substitutions } : {}),
    },
  };
};
