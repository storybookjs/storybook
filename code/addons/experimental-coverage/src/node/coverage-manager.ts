import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';

import {
  FILE_CHANGED_EVENT,
  REQUEST_COVERAGE_EVENT,
  RESULT_FILE_CONTENT,
  type RequestCoverageEventPayload,
  type ResultFileContentPayload,
} from '../constants';
import type { CoverageState, ManagerState, TestingMode } from '../types';
import { CoverageEmitter } from './coverage-emitter';
import { VitestManager } from './vitest-manager';

export class CoverageManager {
  previousState: ManagerState | null = null;

  state: ManagerState = {
    absoluteComponentPath: null,
    absoluteStoryPath: null,
    coverageType: 'component-coverage',
  };

  coverageState: CoverageState = {
    timeStartTesting: 0,
    coverageResults: [],
  };

  private vitestManager: VitestManager;

  coverageEmitter: CoverageEmitter;

  constructor(private channel: Channel) {
    this.coverageEmitter = new CoverageEmitter(channel, this.coverageState);
    this.vitestManager = new VitestManager(
      channel,
      this.state,
      this.coverageState,
      this.coverageEmitter,
      this
    );

    this.channel.on(REQUEST_COVERAGE_EVENT, async (options: RequestCoverageEventPayload) => {
      await this.handleRequestCoverage(options);
      this.setPreviousState();
    });
    this.channel.on(FILE_CHANGED_EVENT, this.emitFileContent.bind(this));
  }

  shouldEmitPreviousCoverage(mode: TestingMode): boolean {
    const isVitestRunning = this.vitestManager.isVitestRunning();

    const isPrevProjectCoverage =
      mode.coverageType === 'project-coverage' &&
      this.previousState?.coverageType === 'project-coverage';

    const isPrevFocusedProjectCoverage =
      mode.coverageType === 'focused-project-coverage' &&
      this.previousState?.coverageType === 'focused-project-coverage';

    return isVitestRunning && (isPrevProjectCoverage || isPrevFocusedProjectCoverage);
  }

  setPreviousState() {
    this.previousState = {
      ...this.state,
    };
  }

  async handleRequestCoverage({
    importPath,
    componentPath,
    initialRequest,
    mode = { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
  }: RequestCoverageEventPayload) {
    this.state.absoluteComponentPath = join(process.cwd(), componentPath);
    this.state.absoluteStoryPath = join(process.cwd(), importPath);
    this.state.coverageType = mode.coverageType;

    if (!componentPath) {
      return;
    }

    await this.emitFileContent(this.state.absoluteComponentPath);

    if (this.shouldEmitPreviousCoverage(mode)) {
      this.coverageEmitter.emitPreviousCoverage(this.state.absoluteComponentPath);
      return;
    }

    if (
      this.previousState?.absoluteComponentPath !== this.state.absoluteComponentPath ||
      initialRequest
    ) {
      this.coverageState.coverageResults = [];
      await this.vitestManager.closeVitest();
      await this.vitestManager.initVitest({
        importPath,
        componentPath,
        absoluteComponentPath: this.state.absoluteComponentPath,
        mode,
      });
    }
  }

  async emitFileContent(absoluteComponentPath: string) {
    const content = await readFile(absoluteComponentPath, 'utf8');
    this.channel.emit(RESULT_FILE_CONTENT, {
      content,
    } satisfies ResultFileContentPayload);
  }

  getFilesWithCoverageInformation() {
    return [this.state.absoluteComponentPath];
  }

  getRelevantFilesForCoverageRecalulation() {
    return [this.state.absoluteComponentPath, this.state.absoluteStoryPath];
  }
}
