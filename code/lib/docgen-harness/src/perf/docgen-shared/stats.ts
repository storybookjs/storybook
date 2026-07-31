/** Statistics helpers shared by the docgen bench harnesses. */
import type { MemorySample, SaveSample } from './samples.ts';

/** Throws on an empty input so a missing series fails loudly. */
export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('median() requires at least one value');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Throws on an empty input so a missing series fails loudly. */
export function mean(values: number[]): number {
  if (values.length === 0) {
    throw new Error('mean() requires at least one value');
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Least-squares slope of `values` vs index, in units-per-step. 0 for fewer than two points. */
export function leastSquaresSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** The retained- and transient-memory figures every series harness derives from its save series. */
export interface SeriesSummary {
  /** Least-squares slope of retained heap over the save series, MB per save. */
  retainedSlope?: number;
  /** Final retained sample minus the pre-series baseline, MB. */
  retainedGrowth?: number;
  /** Per-save allocation spike above the retained baseline, MB. */
  transients: number[];
  /** Mean of {@link transients}. */
  avgTransient?: number;
}

/**
 * Derive the retained/transient series figures shared by every series harness. Kept here so the
 * memory harness and the per-engine harnesses cannot drift apart in how they compute them.
 */
export function summarizeSeries(samples: SaveSample[], baseline: MemorySample): SeriesSummary {
  // Samples taken without --expose-gc carry no retained heap; dropping them keeps a missing reading
  // from being averaged in as a zero.
  const gcSampled = samples.filter(
    (s): s is SaveSample & { retainedHeapMb: number } => s.retainedHeapMb !== undefined
  );
  const retained = gcSampled.map((s) => s.retainedHeapMb);
  const transients = gcSampled.map((s) => s.heapUsedMb - s.retainedHeapMb);
  const last = retained.at(-1);
  return {
    // A slope needs two points. `leastSquaresSlope` answers 0 for a shorter series, which is
    // indistinguishable from a measured flat one, so a series that short reports nothing instead.
    retainedSlope: retained.length >= 2 ? leastSquaresSlope(retained) : undefined,
    retainedGrowth:
      last !== undefined && baseline.retainedHeapMb !== undefined
        ? last - baseline.retainedHeapMb
        : undefined,
    transients,
    avgTransient: transients.length ? mean(transients) : undefined,
  };
}
