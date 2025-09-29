import type { ResolvedCoverageOptions } from 'vitest/node';

import type { ReportNode, Visitor } from 'istanbul-lib-report';
import { ReportBase } from 'istanbul-lib-report';

import type { StoreState } from '../types';
import type { TestManager } from './test-manager';

export type StorybookCoverageReporterOptions = {
  testManager: TestManager;
  coverageOptions: ResolvedCoverageOptions<'v8'> | undefined;
};

class StorybookCoverageReporter extends ReportBase implements Partial<Visitor> {
  #testManager: StorybookCoverageReporterOptions['testManager'];

  #coverageOptions: StorybookCoverageReporterOptions['coverageOptions'];

  constructor(opts: StorybookCoverageReporterOptions) {
    super();
    this.#testManager = opts.testManager;
    this.#coverageOptions = opts.coverageOptions;
  }

  onSummary(node: ReportNode) {
    if (!node.isRoot()) {
      return;
    }
    const rawCoverageSummary = node.getCoverageSummary(false);

    const percentage = Math.round(rawCoverageSummary.data.statements.pct);

    // Fallback to Vitest's default watermarks https://vitest.dev/config/#coverage-watermarks
    const [lowWatermark = 50, highWatermark = 80] =
      this.#coverageOptions?.watermarks?.statements ?? [];

    const coverageSummary: StoreState['currentRun']['coverageSummary'] = {
      percentage,
      status:
        percentage < lowWatermark
          ? 'negative'
          : percentage < highWatermark
            ? 'warning'
            : 'positive',
    };
    this.#testManager.onCoverageCollected(coverageSummary);
  }
}

/**
 * This is exported weirdly because the coverage tool loading this uses `Cont = require(name)`. So
 * it doesn't support a default export, it has to be the "root" export as CJS
 *
 * @see https://nodejs.org/docs/latest-v20.x/api/modules.html#loading-ecmascript-modules-using-require
 */
export { StorybookCoverageReporter as 'module.exports' };
