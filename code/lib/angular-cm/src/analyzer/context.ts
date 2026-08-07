import type * as ts from 'typescript';

import type { MiscCollector } from './misc-collector.ts';

/**
 * Shared state for one `analyzeSourceFile` run. The `ts` module is always passed in by the caller:
 * this package keeps `typescript` as a devDependency only, so the runtime module arrives from the
 * consumer (the docgen worker dynamically imports the user project's TypeScript).
 */
export interface AnalyzerContext {
  ts: typeof ts;
  checker: ts.TypeChecker;
  /** Collector for referenced enums/typealiases (deduped by name). */
  misc: MiscCollector;
}
