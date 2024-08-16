// custom-reporter.cjs
import type { Channel } from 'storybook/internal/channels';

// @ts-expect-error no types
import { ReportBase } from 'istanbul-lib-report';

import type { CoverageItem, CoverageState, CoverageSummary, ManagerState } from '../types';
import { CoverageEmitter } from './coverage-emitter';
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

  coverageEmitter: CoverageEmitter;

  coverageManager: CoverageManager;

  constructor(options: CoverageReporterOptions) {
    super();

    this.channel = options.channel;
    this.coverageState = options.coverageState;
    this.coverageEmitter = new CoverageEmitter(this.channel, this.coverageState);
    this.coverageManager = options.coverageManager;
  }

  private updateCoverageResults({
    coverage,
    coverageSummary,
    executionTime,
  }: {
    coverage: CoverageItem;
    coverageSummary: CoverageSummary;
    executionTime: number;
  }) {
    const existingCoverage = this.coverageState.coverageResults.find(
      (result) => result.stats.path === coverage.path
    );

    if (existingCoverage) {
      existingCoverage.stats = coverage;
      existingCoverage.summary = coverageSummary;
      existingCoverage.executionTime = executionTime;
    } else {
      this.coverageState.coverageResults.push({
        stats: coverage,
        summary: coverageSummary,
        executionTime: executionTime,
      });
    }
  }

  private getExecutionTime(): number {
    return Math.round((performance.now() - this.coverageState.timeStartTesting) * 100) / 100;
  }

  async onDetail(node: Node) {
    const coverage = node.getFileCoverage();
    const coverageSummary = node.getCoverageSummary();
    const executionTime = this.getExecutionTime();

    this.updateCoverageResults({ coverage: coverage.data, coverageSummary, executionTime });

    const filesWithCoverage = this.coverageManager.getFilesWithCoverageInformation();

    filesWithCoverage.forEach((file) => {
      if (file === coverage.data.path) {
        this.coverageEmitter.emitCoverage({
          executionTime,
          stats: coverage.data,
          summary: coverageSummary,
        });
      }
    });
  }
}
