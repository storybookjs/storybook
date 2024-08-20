import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';

import { RESULT_COVERAGE_EVENT, type ResultCoverageEventPayload } from '../constants';
import type { CoverageItem, CoverageState, CoverageSummary } from '../types';
import type { CoverageManager } from './coverage-manager';
import CoverageReporter, { type CoverageReporterOptions } from './coverage-reporter';

describe('CoverageReporter', () => {
  let channel: Channel;
  let coverageManager: CoverageManager;
  let coverageState: CoverageState;
  let coverageReporter: CoverageReporter;

  beforeEach(() => {
    channel = {
      emit: vi.fn(),
    } as unknown as Channel;

    coverageManager = {
      getFilesWithCoverageInformation: vi.fn().mockReturnValue(['some/file/path']),
    } as unknown as CoverageManager;

    coverageState = {
      timeStartTesting: performance.now(),
    } as CoverageState;

    const options: CoverageReporterOptions = {
      channel,
      coverageManager,
      coverageState,
    };

    coverageReporter = new CoverageReporter(options);
  });

  it('should emit RESULT_COVERAGE_EVENT with correct payload', async () => {
    const node = {
      getFileCoverage: vi.fn().mockReturnValue({
        data: {
          path: 'some/file/path',
          // other coverage data
        } as CoverageItem,
      }),
      getCoverageSummary: vi.fn().mockReturnValue({
        // summary data
      } as CoverageSummary),
    };

    await coverageReporter.onDetail(node as any);

    expect(channel.emit).toHaveBeenCalledWith(
      RESULT_COVERAGE_EVENT,
      expect.objectContaining({
        stats: expect.objectContaining({
          path: 'some/file/path',
        }),
        summary: expect.any(Object),
        executionTime: expect.any(Number),
      } as ResultCoverageEventPayload)
    );
  });

  it('should not emit RESULT_COVERAGE_EVENT if file is not in coverage information', async () => {
    const node = {
      getFileCoverage: vi.fn().mockReturnValue({
        data: {
          path: 'another/file/path',
        } as CoverageItem,
      }),
      getCoverageSummary: vi.fn().mockReturnValue({} as CoverageSummary),
    };

    await coverageReporter.onDetail(node as any);

    expect(channel.emit).not.toHaveBeenCalled();
  });
});
