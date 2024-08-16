import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Channel } from 'storybook/internal/channels';

import { RESULT_COVERAGE_EVENT, type ResultCoverageEventPayloadSuccess } from '../constants';
import type { CoverageState } from '../types';
import { CoverageEmitter } from './coverage-emitter';

describe('CoverageEmitter', () => {
  let mockChannel: Channel;
  let mockState: CoverageState;
  let coverageEmitter: CoverageEmitter;

  beforeEach(() => {
    mockChannel = {
      emit: vi.fn(),
    } as unknown as Channel;

    mockState = {
      coverageResults: [
        {
          stats: { path: '/path/to/component' },
          summary: { lines: { total: 10, covered: 8, skipped: 0, pct: 80 } },
          executionTime: 123,
        },
      ],
    } as CoverageState;

    coverageEmitter = new CoverageEmitter(mockChannel, mockState);
  });

  it('should emit previous coverage if path matches', () => {
    coverageEmitter.emitPreviousCoverage('/path/to/component');

    expect(mockChannel.emit).toHaveBeenCalledWith(RESULT_COVERAGE_EVENT, {
      stats: mockState.coverageResults[0].stats,
      summary: mockState.coverageResults[0].summary,
      executionTime: mockState.coverageResults[0].executionTime,
    });
  });

  it('should not emit previous coverage if path does not match', () => {
    coverageEmitter.emitPreviousCoverage('/path/to/another-component');

    expect(mockChannel.emit).not.toHaveBeenCalled();
  });

  it('should emit provided coverage directly', () => {
    const coverage: ResultCoverageEventPayloadSuccess = {
      stats: {
        path: '/path/to/component',
        s: {},
        b: {},
        f: {},
        branchMap: {},
        fnMap: {},
        statementMap: {},
      },
      summary: { lines: { total: 10, covered: 8, skipped: 0, pct: 80 } },
      executionTime: 123,
    };

    coverageEmitter.emitCoverage(coverage);

    expect(mockChannel.emit).toHaveBeenCalledWith(RESULT_COVERAGE_EVENT, coverage);
  });
});
