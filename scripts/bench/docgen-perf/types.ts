/**
 * Shared shapes for the per-engine docgen performance suite. The measurement contract behind these
 * shapes is scripts/bench/PERF-METHODOLOGY.md.
 */

export type EngineId =
  | 'react-legacy'
  | 'react-legacy-rdt'
  | 'react-osa'
  | 'vue-docgen-api'
  | 'vue-component-meta'
  | 'compodoc';

export interface MemorySample {
  rssMb: number;
  heapUsedMb: number;
  retainedHeapMb?: number;
}

export interface SaveSample extends MemorySample {
  save: number;
  durMs: number;
}

/**
 * Subset of a series-harness child's `--json` output that the orchestrator consumes. The
 * docgen-memory harness writes a superset of this; the new engine children write exactly this plus
 * their own options echo.
 */
export interface SeriesHarnessResult {
  coldMs: number;
  baseline: MemorySample;
  samples: SaveSample[];
  retainedSlope?: number;
  retainedGrowth?: number;
  /**
   * Documented members the cold pass produced. Two engines over the same project can differ by an
   * order of magnitude here, and a timing ratio between them means nothing without it.
   */
  coldMembers?: number;
}

/** A latency metric: median of repeated samples (fresh process each, for cold/scan). */
export interface LatencyMetric {
  status: 'measured';
  samples: number[];
  median: number;
}

/** A memory metric aggregated as the mean of a per-save (or per-run) series. */
export interface SeriesMeanMetric {
  status: 'measured';
  samples: number[];
  mean: number;
}

/** A single-valued metric read from one run's series (retained growth, retained slope). */
export interface ValueMetric {
  status: 'measured';
  value: number;
}

/** The explicit marker for a metric that does not apply to an engine; never a faked equivalent. */
export interface NotApplicable {
  status: 'n/a';
}

export const NOT_APPLICABLE: NotApplicable = { status: 'n/a' };

export interface EngineMetrics {
  coldExtractionMs: LatencyMetric | NotApplicable;
  warmExtractionMs: LatencyMetric | NotApplicable;
  wholeProjectScanMs: LatencyMetric | NotApplicable;
  peakTransientMb: SeriesMeanMetric | NotApplicable;
  retainedGrowthMb: ValueMetric | NotApplicable;
  retainedSlopeMbPerSave: ValueMetric | NotApplicable;
}

export interface ScenarioResult {
  params: Record<string, number | string | boolean>;
  metrics: EngineMetrics;
}

export type EngineResult =
  | { status: 'measured'; scenarios: Record<string, ScenarioResult> }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export interface SuiteResults {
  generatedAt: string;
  nodeVersion: string;
  /** The one pinned N; numbers taken at different N are not comparable. */
  pinnedN: number;
  /** False for --quick smoke runs, whose numbers must never be compared against real runs. */
  comparable: boolean;
  /** Sampling interval for the compodoc child's externally-polled peak RSS. */
  rssPollIntervalMs: number;
  /** Resolved compodoc version, when that engine ran. Its cost moves across versions. */
  compodocVersion?: string;
  engines: Partial<Record<EngineId, EngineResult>>;
  /**
   * Each framework's legacy-engine median divided by its new-engine median, both measured in this
   * same invocation. React pairs react-docgen against react-osa; Vue pairs vue-docgen-api (still
   * the default plugin) against vue-component-meta. These are the calibration references budgets
   * are derived from.
   */
  ratios: {
    coldLegacyVsOsa?: number;
    warmLegacyVsOsa?: number;
    coldVueLegacyVsMeta?: Record<string, number>;
    warmVueLegacyVsMeta?: Record<string, number>;
  };
}
