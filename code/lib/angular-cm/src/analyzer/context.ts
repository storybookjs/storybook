import type * as ts from 'typescript';

import type { TypeIndex } from './type-index.ts';

// `ts` is carried rather than imported because the runtime module is the user project's own
// TypeScript.
export interface AnalyzerContext {
  ts: typeof ts;
  checker: ts.TypeChecker;
  /** Rendering a type through this also files it under `miscellaneous`. */
  types: TypeIndex;
}

export const resolvedSymbol = (ctx: AnalyzerContext, node: ts.Node): ts.Symbol | undefined => {
  const symbol = ctx.checker.getSymbolAtLocation(node);
  return symbol && symbol.flags & ctx.ts.SymbolFlags.Alias
    ? ctx.checker.getAliasedSymbol(symbol)
    : symbol;
};
