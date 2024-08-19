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
  };

  private vitestManager: VitestManager;

  constructor(private channel: Channel) {
    this.vitestManager = new VitestManager(channel, this.state, this.coverageState, this);

    this.channel.on(REQUEST_COVERAGE_EVENT, async (options: RequestCoverageEventPayload) => {
      await this.handleRequestCoverage(options);
      this.setPreviousState();
    });
    this.channel.on(FILE_CHANGED_EVENT, this.emitFileContent.bind(this));
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

    if (!componentPath) return;

    const hasComponentPathChanged =
      this.previousState &&
      this.previousState.absoluteComponentPath !== this.state.absoluteComponentPath;

    if (initialRequest || hasComponentPathChanged) {
      await this.emitFileContent(this.state.absoluteComponentPath);
    }

    const changedCoverageType =
      this.previousState && this.state.coverageType !== this.previousState.coverageType;
    const changedComponentPath =
      this.state.coverageType === 'component-coverage' && hasComponentPathChanged;

    if (initialRequest || changedCoverageType || changedComponentPath) {
      await this.vitestManager.closeVitest();
      await this.vitestManager.initVitest({
        importPath,
        componentPath,
        absoluteComponentPath: this.state.absoluteComponentPath,
        mode,
      });
    } else if (this.state.coverageType === 'project-coverage' && hasComponentPathChanged) {
      this.coverageState.timeStartTesting = performance.now();
      await this.vitestManager.runAffectedTests(this.state.absoluteComponentPath);
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
