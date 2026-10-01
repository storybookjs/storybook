import type { ReportNode, Visitor } from 'istanbul-lib-report';
import { ReportBase } from 'istanbul-lib-report';

import type { StoreState } from '../types.ts';
import type { TestManager } from './test-manager.ts';

export type StorybookCoverageReporterOptions = {
  testManager: TestManager;
};

class StorybookCoverageReporter extends ReportBase implements Partial<Visitor> {
  #testManager: StorybookCoverageReporterOptions['testManager'];

  constructor(opts: StorybookCoverageReporterOptions) {
    super();
    this.#testManager = opts.testManager;
  }

  onSummary(node: ReportNode) {
    if (!node.isRoot()) {
      return;
    }
    const rawCoverageSummary = node.getCoverageSummary(false);

    const percentage = Math.round(rawCoverageSummary.data.statements.pct);

    // Fallback to Vitest's default watermarks https://vitest.dev/config/#coverage-watermarks
    const [lowWatermark = 50, highWatermark = 80] =
      this.#testManager.vitestManager.vitest?.config.coverage.watermarks?.statements ?? [];

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

export default StorybookCoverageReporter;

// Vitest 3 and 4 load custom coverage reporters with require(name).
export { StorybookCoverageReporter as 'module.exports' };
