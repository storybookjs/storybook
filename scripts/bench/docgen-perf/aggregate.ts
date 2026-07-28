/**
 * Turning N repetitions into the five floor metrics, per scripts/bench/PERF-METHODOLOGY.md.
 *
 * Cold latency is the median across repetitions. Warm latency and all three memory metrics read one
 * repetition's save series, and they read the same one, so those four figures always describe the
 * same run.
 */
import type { SeriesResult } from '../docgen-shared/series.ts';
import { mean, median } from '../docgen-shared/stats.ts';
import { type EngineMetrics, NOT_APPLICABLE } from './types.ts';

/**
 * The repetition whose cold sample is the median. Repetition 1 is systematically the slowest - it
 * pays for a cold module graph and a cold OS page cache - so taking it would bias warm latency and
 * all three memory metrics at once. Cold latency needs no such protection: it is already a median
 * across every repetition.
 */
export function designatedRep<T extends { coldMs: number }>(reps: T[]): T {
  const byCold = [...reps].sort((a, b) => a.coldMs - b.coldMs);
  return byCold[Math.floor((byCold.length - 1) / 2)];
}

/** Per-save allocation spikes above the retained baseline, for the repetitions the child sampled. */
function transientsOf(rep: SeriesResult): number[] {
  return rep.samples
    .map((s) => (s.retainedHeapMb !== undefined ? s.heapUsedMb - s.retainedHeapMb : undefined))
    .filter((v): v is number => v !== undefined);
}

/**
 * Reject a repetition count that is not the pinned N. An engine that failed part-way through holds
 * fewer samples, and reporting those as a result would put numbers taken at an unrecorded N into the
 * results file - which the whole comparison method rests on not happening.
 */
function assertRepetitionCount(reps: unknown[] | undefined, expectedN: number): void {
  if (!reps || reps.length === 0) {
    throw new Error('no completed repetition recorded');
  }
  if (reps.length !== expectedN) {
    throw new Error(`recorded ${reps.length} repetitions, expected the pinned ${expectedN}`);
  }
}

export function seriesMetrics(reps: SeriesResult[] | undefined, expectedN: number): EngineMetrics {
  assertRepetitionCount(reps, expectedN);
  const designated = designatedRep(reps!);
  const coldSamples = reps!.map((r) => r.coldMs);
  const warmSamples = designated.samples.map((s) => s.durMs);
  const transients = transientsOf(designated);

  if (
    transients.length === 0 ||
    designated.retainedGrowth === undefined ||
    designated.retainedSlope === undefined
  ) {
    throw new Error('retained metrics missing (child must run under --expose-gc)');
  }

  return {
    coldExtractionMs: { status: 'measured', samples: coldSamples, median: median(coldSamples) },
    warmExtractionMs: { status: 'measured', samples: warmSamples, median: median(warmSamples) },
    // Per-component engines have no batch pass; recording one would be a faked equivalent.
    wholeProjectScanMs: NOT_APPLICABLE,
    peakTransientMb: { status: 'measured', samples: transients, mean: mean(transients) },
    retainedGrowthMb: { status: 'measured', value: designated.retainedGrowth },
    retainedSlopeMbPerSave: { status: 'measured', value: designated.retainedSlope },
  };
}

export interface OneShotRepetition {
  coldMs: number;
  warmMs: number;
  peakRssMb: number;
}

/**
 * Metrics for a one-shot CLI engine: a fresh process per run, so cold extraction and the
 * whole-project scan are the same full-project measurement, and there is no retained series to read.
 */
export function oneShotMetrics(reps: OneShotRepetition[], expectedN: number): EngineMetrics {
  assertRepetitionCount(reps, expectedN);
  const coldSamples = reps.map((r) => r.coldMs);
  const warmSamples = reps.map((r) => r.warmMs);
  const peaks = reps.map((r) => r.peakRssMb);
  return {
    coldExtractionMs: { status: 'measured', samples: coldSamples, median: median(coldSamples) },
    warmExtractionMs: { status: 'measured', samples: warmSamples, median: median(warmSamples) },
    wholeProjectScanMs: { status: 'measured', samples: coldSamples, median: median(coldSamples) },
    peakTransientMb: { status: 'measured', samples: peaks, mean: mean(peaks) },
    retainedGrowthMb: NOT_APPLICABLE,
    retainedSlopeMbPerSave: NOT_APPLICABLE,
  };
}
