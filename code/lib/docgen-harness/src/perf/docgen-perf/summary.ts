import type { LatencyObservation, LatencyRepetition } from '../docgen-shared/latency-series.ts';
import { median } from '../docgen-shared/stats.ts';
import type { ScenarioLatencySummary } from './types.ts';

export function assertRepetitionCount(repetitions: unknown[], expected: number): void {
  if (repetitions.length === 0) {
    throw new Error('no completed repetition recorded');
  }
  if (repetitions.length !== expected) {
    throw new Error(`recorded ${repetitions.length} repetitions, expected ${expected}`);
  }
}

function assertCount(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`${label} must be a non-negative safe integer when present`);
  }
}

function assertObservation(
  observation: LatencyObservation | undefined,
  label: string
): asserts observation is LatencyObservation {
  if (!observation || !Number.isFinite(observation.durationMs) || observation.durationMs <= 0) {
    throw new Error(`${label} must contain a finite positive duration`);
  }
  assertCount(observation.members, `${label} members`);
  assertCount(observation.opaqueTypes, `${label} opaque types`);
  if (
    observation.members !== undefined &&
    observation.opaqueTypes !== undefined &&
    observation.opaqueTypes > observation.members
  ) {
    throw new Error(`${label} opaque types cannot exceed documented members`);
  }
}

/** Rejects truncated or malformed child JSON before it can become a headline or paired block. */
export function assertCompleteLatencyRepetitions(
  repetitions: LatencyRepetition[],
  expectedRepetitions: number,
  expectedWarmObservations?: number
): void {
  assertRepetitionCount(repetitions, expectedRepetitions);
  for (const [repetitionIndex, repetition] of repetitions.entries()) {
    const prefix = `repetition ${repetitionIndex + 1}`;
    assertObservation(repetition.cold, `${prefix} cold observation`);
    if (!Array.isArray(repetition.warm) || repetition.warm.length === 0) {
      throw new Error(`${prefix} recorded no warm observations`);
    }
    if (
      expectedWarmObservations !== undefined &&
      repetition.warm.length !== expectedWarmObservations
    ) {
      throw new Error(
        `${prefix} recorded ${repetition.warm.length} warm observations, expected ${expectedWarmObservations}`
      );
    }
    for (const [warmIndex, observation] of repetition.warm.entries()) {
      const expectedSave = warmIndex + 1;
      if (observation.save !== expectedSave) {
        throw new Error(
          `${prefix} warm observation ${expectedSave} is labeled save ${observation.save}`
        );
      }
      assertObservation(observation, `${prefix} warm observation ${expectedSave}`);
    }
    if (repetition.scan !== undefined) {
      assertObservation(repetition.scan, `${prefix} scan observation`);
    }
  }
}

export function warmTrajectoryMedian(repetition: LatencyRepetition): number {
  return median(repetition.warm.map((observation) => observation.durationMs));
}

export function summarizeLatencyRepetitions(
  repetitions: LatencyRepetition[]
): ScenarioLatencySummary {
  const cold = repetitions.map((repetition) => repetition.cold.durationMs);
  const warm = repetitions.map(warmTrajectoryMedian);
  const scans = repetitions.map((repetition) => repetition.scan?.durationMs);
  const completeScans = scans.filter((duration): duration is number => duration !== undefined);
  if (completeScans.length > 0 && completeScans.length !== repetitions.length) {
    throw new Error(
      `recorded ${completeScans.length} scan observations for ${repetitions.length} repetitions`
    );
  }

  return {
    cold: { processSamplesMs: cold, medianMs: median(cold) },
    warm: { processSamplesMs: warm, medianMs: median(warm) },
    ...(completeScans.length > 0
      ? { scan: { processSamplesMs: completeScans, medianMs: median(completeScans) } }
      : {}),
  };
}
