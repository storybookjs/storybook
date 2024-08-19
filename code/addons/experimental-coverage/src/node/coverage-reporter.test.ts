import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';

import { REQUEST_COVERAGE_EVENT, type RequestCoverageEventPayload } from '../constants';
import type { CoverageState } from '../types';
import { CoverageManager } from './coverage-manager';
import CoverageReporter from './coverage-reporter';

describe('CustomReporter', () => {
  let mockChannel: Channel;
  let channelListener: Record<string, (options: any) => any> = {};
  let coverageManager: CoverageManager;

  beforeEach(() => {
    channelListener = {};
    mockChannel = {
      on: vi.fn((event, listener) => {
        channelListener[event] = listener;
      }),
      emit: vi.fn((event, options) => {
        channelListener[event](options);
      }),
    } as unknown as Channel;
    coverageManager = new CoverageManager(mockChannel);

    mockChannel.emit(REQUEST_COVERAGE_EVENT, {
      componentPath: 'some/component/path',
      importPath: 'some/import/path',
      initialRequest: false,
      mode: { browser: true, coverageProvider: 'istanbul', coverageType: 'component-coverage' },
    } as RequestCoverageEventPayload);
  });

  it('should update state and emit coverage on onDetail', async () => {
    // Mock dependencies
    const coverageState: CoverageState = {
      timeStartTesting: performance.now(),
    };

    // Mock CoverageEmitter
    const mockCoverageEmitter = {
      emitCoverage: vi.fn(),
    };

    coverageManager.coverageState = coverageState;

    // Instantiate CustomReporter
    const reporter = new CoverageReporter({
      channel: mockChannel,
      coverageState: coverageState,
      coverageManager: coverageManager,
    });

    // Mock node object
    const mockNode = {
      getFileCoverage: vi.fn().mockReturnValue({
        data: {
          path: '/path/to/component.tsx',
        },
      }),
      getCoverageSummary: vi.fn().mockReturnValue({}),
    };

    // Call onDetail
    await reporter.onDetail(mockNode);

    // Verify emitter call
    expect(mockCoverageEmitter.emitCoverage).toHaveBeenCalledWith({
      executionTime: expect.any(Number),
      stats: expect.any(Object),
      summary: expect.any(Object),
    });
  });
});
