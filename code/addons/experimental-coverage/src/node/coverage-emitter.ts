import type { Channel } from 'storybook/internal/channels';

import {
  COVERAGE_IN_PROGRESS,
  RESULT_COVERAGE_EVENT,
  type ResultCoverageEventPayload,
  type ResultCoverageEventPayloadSuccess,
} from '../constants';
import type { CoverageState } from '../types';

export class CoverageEmitter {
  constructor(
    private channel: Channel,
    private coverageState: CoverageState
  ) {}

  emitPreviousCoverage(absoluteComponentPath: string) {
    this.coverageState.coverageResults.every((result) => {
      if (result.stats.path === absoluteComponentPath) {
        this.channel.emit(RESULT_COVERAGE_EVENT, {
          stats: result.stats,
          summary: result.summary,
          executionTime: result.executionTime,
        } satisfies ResultCoverageEventPayload);
        return false;
      }
      return true;
    });
  }

  emitCoverage(coverage: ResultCoverageEventPayloadSuccess) {
    this.channel.emit(RESULT_COVERAGE_EVENT, coverage satisfies ResultCoverageEventPayload);
  }

  emitCoverageStart() {
    this.channel.emit(COVERAGE_IN_PROGRESS);
  }
}
