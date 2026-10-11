/**
 * Turns N repetitions into the five floor metrics (see ../PERF-METHODOLOGY.md). Warm
 * latency and all three memory metrics read the same designated repetition's save series, so those
 * four figures always describe one run; cold latency is a median across every repetition instead.
 */
import type { SeriesResult } from '../docgen-shared/series.ts';
import { mean, median } from '../docgen-shared/stats.ts';
import { type EngineMetrics, NOT_APPLICABLE } from './types.ts';

/**
 * Repetition 1 is systematically the slowest - it pays for a cold module graph and a cold OS page
 * cache - so taking it would bias warm latency and all three memory metrics at once. Cold latency
 * needs no such protection: it is already a median across every repetition.
 */
export function designatedRep<T extends { coldMs: number }>(reps: T[]): T {
  const byCold = [...reps].sort((a, b) => a.coldMs - b.coldMs);
  return byCold[Math.floor((byCold.length - 1) / 2)];
}

/**
 * An engine that failed part-way through holds fewer samples than expectedN. Reporting those would
 * put numbers taken at an unrecorded N into the results file, which the comparison method rests on
 * not happening.
 */
function assertRepetitionCount(reps: unknown[], expectedN: number): void {
  if (reps.length === 0) {
    throw new Error('no completed repetition recorded');
  }
  if (reps.length !== expectedN) {
    throw new Error(`recorded ${reps.length} repetitions, expected the pinned ${expectedN}`);
  }
}

export function seriesMetrics(reps: SeriesResult[], expectedN: number): EngineMetrics {
  assertRepetitionCount(reps, expectedN);
  const designated = designatedRep(reps);
  const coldSamples = reps.map((r) => r.coldMs);
  const warmSamples = designated.samples.map((s) => s.durMs);
  const { transients, avgTransient } = designated;

  if (
    avgTransient === undefined ||
    designated.retainedGrowth === undefined ||
    designated.retainedSlope === undefined
  ) {
    throw new Error(
      'retained metrics missing: the child must run under --expose-gc, over at least two saves'
    );
  }

  return {
    coldExtractionMs: { status: 'measured', samples: coldSamples, value: median(coldSamples) },
    warmExtractionMs: { status: 'measured', samples: warmSamples, value: median(warmSamples) },
    // Per-component engines have no batch pass; recording one would be a faked equivalent.
    wholeProjectScanMs: NOT_APPLICABLE,
    peakTransientMb: { status: 'measured', samples: transients, value: avgTransient },
    retainedGrowthMb: { status: 'measured', value: designated.retainedGrowth },
    retainedSlopeMbPerSave: { status: 'measured', value: designated.retainedSlope },
  };
}

export interface OneShotRepetition {
  coldMs: number;
  warmMs: number;
  /** Undefined when the engine's external sampler never read the child's memory. */
  peakRssMb?: number;
  coldMembers?: number;
  warmMembers?: number;
  /** Of the cold pass's members, how many carry a type the engine never resolved. */
  coldOpaqueTypes?: number;
}

/**
 * Metrics for a one-shot CLI engine: a fresh process per run, so cold extraction and the
 * whole-project scan are the same full-project measurement, and there is no retained series to read.
 */
export function oneShotMetrics(reps: OneShotRepetition[], expectedN: number): EngineMetrics {
  assertRepetitionCount(reps, expectedN);
  const coldSamples = reps.map((r) => r.coldMs);
  const warmSamples = reps.map((r) => r.warmMs);
  // Every repetition must have been sampled, or the mean describes a different N than the one
  // recorded. A partially-sampled series is reported as no measurement rather than as a low one.
  const peaks = reps.map((r) => r.peakRssMb).filter((mb) => mb !== undefined);
  return {
    coldExtractionMs: { status: 'measured', samples: coldSamples, value: median(coldSamples) },
    warmExtractionMs: { status: 'measured', samples: warmSamples, value: median(warmSamples) },
    wholeProjectScanMs: { status: 'measured', samples: coldSamples, value: median(coldSamples) },
    peakTransientMb:
      peaks.length === reps.length
        ? { status: 'measured', samples: peaks, value: mean(peaks) }
        : NOT_APPLICABLE,
    retainedGrowthMb: NOT_APPLICABLE,
    retainedSlopeMbPerSave: NOT_APPLICABLE,
  };
}
