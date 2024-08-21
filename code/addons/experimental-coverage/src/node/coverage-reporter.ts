// custom-reporter.cjs
import type { Channel } from 'storybook/internal/channels';

// @ts-expect-error no types
import { ReportBase } from 'istanbul-lib-report';

import { RESULT_COVERAGE_EVENT, type ResultCoverageEventPayload } from '../constants';
import type { CoverageItem, CoverageState, CoverageSummary, ManagerState } from '../types';
import type { CoverageManager } from './coverage-manager';

type Node = {
  getFileCoverage: () => {
    data: CoverageItem;
  };
  getCoverageSummary: () => CoverageSummary;
};

export type CoverageReporterOptions = {
  channel: Channel;
  coverageManager: CoverageManager;
  coverageState: CoverageState;
};

export default class CoverageReporter extends ReportBase {
  channel: Channel;

  coverageState: CoverageState;

  file: any;

  coverageManager: CoverageManager;

  constructor(options: CoverageReporterOptions) {
    super();

    this.channel = options.channel;
    this.coverageState = options.coverageState;
    this.coverageManager = options.coverageManager;
  }

  private getExecutionTime(): number {
    return Math.round((performance.now() - this.coverageState.timeStartTesting) * 100) / 100;
  }

  async onDetail(node: Node) {
    try {
      const coverage = node.getFileCoverage();
      const coverageSummary = node.getCoverageSummary();
      const executionTime = this.getExecutionTime();

      const filesWithCoverage = this.coverageManager.getFilesWithCoverageInformation();

      filesWithCoverage.forEach((file) => {
        if (file === coverage.data.path) {
          this.channel.emit(RESULT_COVERAGE_EVENT, {
            executionTime,
            stats: coverage.data,
            summary: coverageSummary,
          } satisfies ResultCoverageEventPayload);
        }
      });
    } catch (e) {
      // TODO: Properly handle error
      console.error(e);
    }
  }
}
