import { describe, expect, it } from 'vitest';

import type { LatencyRepetition } from '../docgen-shared/latency-series.ts';
import {
  assertCompleteLatencyRepetitions,
  assertRepetitionCount,
  summarizeLatencyRepetitions,
  warmTrajectoryMedian,
} from './summary.ts';

function repetition(cold: number, warm: number[], scan?: number): LatencyRepetition {
  return {
    cold: { durationMs: cold, members: 10 },
    warm: warm.map((durationMs, index) => ({ save: index + 1, durationMs, members: 2 })),
    ...(scan === undefined ? {} : { scan: { durationMs: scan, members: 10 } }),
  };
}

describe('latency summaries', () => {
  it('keeps one independent warm summary per fresh process', () => {
    const repetitions = [repetition(300, [1, 9, 5]), repetition(100, [20, 10, 30])];
    expect(repetitions[0].warm.map(({ save }) => save)).toEqual([1, 2, 3]);
    expect(summarizeLatencyRepetitions(repetitions)).toEqual({
      cold: { processSamplesMs: [300, 100], medianMs: 200 },
      warm: { processSamplesMs: [5, 20], medianMs: 12.5 },
    });
  });

  it('summarizes a whole-project scan only when every process reported one', () => {
    expect(
      summarizeLatencyRepetitions([repetition(10, [2], 10), repetition(20, [4], 20)]).scan
    ).toMatchObject({ processSamplesMs: [10, 20], medianMs: 15 });
    expect(() =>
      summarizeLatencyRepetitions([repetition(10, [2], 10), repetition(20, [4])])
    ).toThrow('recorded 1 scan observations for 2 repetitions');
  });

  it('does not mutate a chronological trajectory while calculating its median', () => {
    const value = repetition(10, [9, 1, 5]);
    expect(warmTrajectoryMedian(value)).toBe(5);
    expect(value.warm.map(({ durationMs }) => durationMs)).toEqual([9, 1, 5]);
  });

  it('rejects missing or incomplete fresh-process repetitions', () => {
    expect(() => assertRepetitionCount([], 2)).toThrow('no completed repetition');
    expect(() => assertRepetitionCount([{}], 2)).toThrow('recorded 1 repetitions, expected 2');

    const missingSave = repetition(10, [2, 3]);
    missingSave.warm.pop();
    expect(() => assertCompleteLatencyRepetitions([missingSave], 1, 2)).toThrow(
      'recorded 1 warm observations, expected 2'
    );

    const outOfOrder = repetition(10, [2, 3]);
    outOfOrder.warm[1].save = 3;
    expect(() => assertCompleteLatencyRepetitions([outOfOrder], 1, 2)).toThrow(
      'warm observation 2 is labeled save 3'
    );

    const invalidDuration = repetition(10, [2]);
    invalidDuration.cold.durationMs = Number.NaN;
    expect(() => assertCompleteLatencyRepetitions([invalidDuration], 1, 1)).toThrow(
      'finite positive duration'
    );

    const impossibleWork = repetition(10, [2]);
    impossibleWork.cold.opaqueTypes = 11;
    expect(() => assertCompleteLatencyRepetitions([impossibleWork], 1, 1)).toThrow(
      'opaque types cannot exceed documented members'
    );
  });
});
