import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Vitest } from 'vitest/node';

import fs from 'fs';

import type { CoverageState, ManagerState } from '../types';
import type { CoverageEmitter } from './coverage-emitter';
import type { CoverageManager } from './coverage-manager';
import { VitestReporter } from './vitest-coverage-reporter';

describe('VitestCoverageReporter', () => {
  let previousState: ManagerState;
  let coverageState: CoverageState;
  let coverageEmitter: CoverageEmitter;
  let coverageManager: CoverageManager;
  let reporter: VitestReporter;
  let ctx: Vitest;

  beforeEach(() => {
    previousState = {
      absoluteComponentPath: '/path/to/component.tsx',
      absoluteStoryPath: '/path/to/story.tsx',
      coverageType: 'component-coverage',
    };
    coverageState = {
      timeStartTesting: 0,
      coverageResults: [],
    };
    coverageEmitter = {
      emitCoverageStart: vi.fn(),
      emitCoverage: vi.fn(),
    } as unknown as CoverageEmitter;
    coverageManager = {
      getRelevantFilesForCoverageRecalulation: vi.fn().mockReturnValue(['file1.ts', 'file2.ts']),
    } as unknown as CoverageManager;

    ctx = {
      cancelCurrentRun: vi.fn(),
    } as any as Vitest;

    reporter = new VitestReporter({
      managerState: previousState,
      coverageState,
      coverageEmitter,
      coverageManager,
    });
    reporter.ctx = ctx;
  });

  it('should set the start time and emit coverage start on initialization', () => {
    reporter.onInit(ctx);

    expect(coverageState.timeStartTesting).toBeGreaterThan(0);
    expect(coverageEmitter.emitCoverageStart).toHaveBeenCalled();
  });

  it('should set the start time and emit coverage start on watcher rerun if relevant files are changed', async () => {
    const files = ['file1.ts'];
    await reporter.onWatcherRerun(files);

    expect(coverageState.timeStartTesting).toBeGreaterThan(0);
    expect(coverageEmitter.emitCoverageStart).toHaveBeenCalled();
  });

  it('should not emit coverage start on watcher rerun if no relevant files are changed', async () => {
    const files = ['file3.ts'];

    await reporter.onWatcherRerun(files);

    expect(coverageState.timeStartTesting).toBe(0);
    expect(coverageEmitter.emitCoverageStart).not.toHaveBeenCalled();
  });

  it('should touch the component file and cancel current run if in project based coverage mode and component has not changed', async () => {
    previousState.coverageType = 'project-coverage';
    const files = ['file3.ts'];
    const trigger = 'file4.ts';

    vi.spyOn(fs, 'utimesSync').mockImplementation(() => {});

    await reporter.onWatcherRerun(files, trigger);

    expect(ctx.cancelCurrentRun).toHaveBeenCalledWith('keyboard-input');
    expect(fs.utimesSync).toHaveBeenCalledWith(
      '/path/to/component.tsx',
      expect.any(Date),
      expect.any(Date)
    );
  });
});
