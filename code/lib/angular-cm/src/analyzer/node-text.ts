import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';

/**
 * Node-to-string helpers that both the member visitors and the signal readers need. They live apart
 * from either so the two modules stay a one-way dependency.
 */

/** Declared name of a member; a computed name keeps its bracketed source spelling. */
export const memberName = (ctx: AnalyzerContext, name: ts.PropertyName): string => {
  const { ts } = ctx;
  if (ts.isComputedPropertyName(name)) {
    return name.getText();
  }
  return name.text;
};

/** Raw initializer text, with arrow functions collapsed to the legacy `() => {...}` marker. */
export const initializerText = (ctx: AnalyzerContext, initializer: ts.Expression): string =>
  ctx.ts.isArrowFunction(initializer) ? '() => {...}' : initializer.getText();
