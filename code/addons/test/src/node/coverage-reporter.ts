import type { ResolvedCoverageOptions } from 'vitest/node';

import type { ReportNode, Visitor } from 'istanbul-lib-report';
import { ReportBase } from 'istanbul-lib-report';

import { type Details, TEST_PROVIDER_ID } from '../constants';
import type { TestManager } from './test-manager';

export type StorybookCoverageReporterOptions = {
  testManager: TestManager;
  coverageOptions: ResolvedCoverageOptions<'v8'>;
};

export default class StorybookCoverageReporter extends ReportBase implements Partial<Visitor> {
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
    const coverageSummary = node.getCoverageSummary(false);

    const percentage = Math.round(coverageSummary.data.statements.pct);

    // Fallback to Vitest's default watermarks https://vitest.dev/config/#coverage-watermarks
    const [lowWatermark = 50, highWatermark = 80] =
      this.#coverageOptions.watermarks?.statements ?? [];

    const coverageDetails: Details['coverageSummary'] = {
      percentage,
      status:
        percentage < lowWatermark
          ? 'negative'
          : percentage < highWatermark
            ? 'warning'
            : 'positive',
    };
    this.#testManager.sendProgressReport({
      providerId: TEST_PROVIDER_ID,
      details: {
        coverageSummary: coverageDetails,
      },
    });
  }
}
