import type * as ts from 'typescript';

import type { MiscCollector } from './misc-collector.ts';

// `ts` is carried rather than imported because the runtime module is the user project's own
// TypeScript.
export interface AnalyzerContext {
  ts: typeof ts;
  checker: ts.TypeChecker;
  misc: MiscCollector;
}
