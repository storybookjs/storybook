import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';

export const memberName = (ctx: AnalyzerContext, name: ts.PropertyName): string => {
  const { ts } = ctx;
  if (ts.isComputedPropertyName(name)) {
    return name.getText();
  }
  return name.text;
};

export const initializerText = (ctx: AnalyzerContext, initializer: ts.Expression): string =>
  ctx.ts.isArrowFunction(initializer) ? '() => {...}' : initializer.getText();
