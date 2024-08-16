import fs from 'node:fs';

import type { Vitest } from 'vitest/node';
import type { Reporter } from 'vitest/reporters';

import type { CoverageState, ManagerState } from '../types';
import type { CoverageEmitter } from './coverage-emitter';
import type { CoverageManager } from './coverage-manager';

export type VitestReporterOptions = {
  managerState: ManagerState;
  coverageEmitter: CoverageEmitter;
  coverageManager: CoverageManager;
  coverageState: CoverageState;
};

export class VitestReporter implements Reporter {
  ctx!: Vitest;

  managerState: ManagerState;

  coverageState: CoverageState;

  coverageEmitter: CoverageEmitter;

  coverageManager: CoverageManager;

  cancelledRun = false;

  constructor(options: VitestReporterOptions) {
    this.managerState = options.managerState;
    this.coverageState = options.coverageState;
    this.coverageEmitter = options.coverageEmitter;
    this.coverageManager = options.coverageManager;
  }

  private markCoverageStart() {
    this.coverageState.timeStartTesting = performance.now();
    this.coverageEmitter.emitCoverageStart();
  }

  onInit(ctx: Vitest) {
    this.ctx = ctx;
    this.markCoverageStart();
  }

  async onWatcherRerun(files: string[], trigger?: string) {
    const relevantFiles = this.coverageManager.getRelevantFilesForCoverageRecalulation();
    const isProjectBasedCoverage =
      this.managerState.coverageType === 'project-coverage' ||
      this.managerState.coverageType === 'focused-project-coverage';

    const hasComponentChanged =
      files.some((file) => this.managerState.absoluteComponentPath === file) ||
      (trigger && this.managerState.absoluteComponentPath?.includes(trigger));

    if (isProjectBasedCoverage && this.managerState.absoluteComponentPath && !hasComponentChanged) {
      // In project based coverage mode, we don't know which files are relevant to the coverage recalculation
      // so we need to touch the component file to trigger the watcher
      await this.ctx.cancelCurrentRun('keyboard-input');
      this.cancelledRun = true;
      fs.utimesSync(this.managerState.absoluteComponentPath, new Date(), new Date());
      this.markCoverageStart();
      return;
    }

    if (isProjectBasedCoverage || files.some((file) => relevantFiles.includes(file))) {
      if (!this.cancelledRun) {
        this.markCoverageStart();
      }
      this.cancelledRun = false;
    }
  }
}
