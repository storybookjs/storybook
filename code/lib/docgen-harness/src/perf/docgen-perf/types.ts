/**
 * Result shapes for the per-engine docgen performance suite. The measurement contract behind these
 * shapes is ../PERF-METHODOLOGY.md.
 */
import type { EngineId } from '../docgen-shared/engine-ids.ts';

export type { EngineId };

/**
 * A measured number. Which statistic it is belongs to the field that holds it - a median across
 * repetitions for latency, a mean of a series for peak memory - and every reader wants the number.
 */
export interface MeasuredMetric {
  status: 'measured';
  value: number;
  /** What it was aggregated from; absent for a figure read straight off one run's series. */
  samples?: number[];
}

/** The explicit marker for a metric that does not apply to an engine; never a faked equivalent. */
export interface NotApplicable {
  status: 'n/a';
}

export const NOT_APPLICABLE: NotApplicable = { status: 'n/a' };

export type Metric = MeasuredMetric | NotApplicable;

export interface EngineMetrics {
  coldExtractionMs: Metric;
  warmExtractionMs: Metric;
  wholeProjectScanMs: Metric;
  peakTransientMb: Metric;
  retainedGrowthMb: Metric;
  retainedSlopeMbPerSave: Metric;
}

/**
 * What one repetition documented. Every field is optional because an engine that cannot report a
 * count must leave it out; a zero would read as "documented nothing", which is a different claim.
 */
export interface MemberCounts {
  /**
   * Members the cold pass documented, when the engine reports it. Two engines over the same project
   * can differ by an order of magnitude here, and a timing ratio between them means nothing without
   * it.
   */
  coldMembers?: number;
  /** Members the timed re-extraction documented. Warm ratios need this for the same reason. */
  warmMembers?: number;
  /**
   * Of {@link coldMembers}, how many the engine documented under a type name it never resolved.
   * An engine that prints `Hop19Shape` and one that expands it into its fields report the same
   * member count off very different work, so equal counts alone do not make a ratio like-for-like.
   */
  coldOpaqueTypes?: number;
}

export interface ScenarioResult extends MemberCounts {
  params: Record<string, number | string | boolean>;
  metrics: EngineMetrics;
}

export type EngineResult =
  | { status: 'measured'; scenarios: Record<string, ScenarioResult> }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

/**
 * Whether a ratio compared equal work, and when it did not, which side did more.
 *
 * The direction decides how to read the number. A new engine that did less is fast for the wrong
 * reason and its ratio is worthless; one that did more and still won has a ratio that understates
 * it. Only `like-for-like` may become a budget.
 *
 * The two `resolves` cases exist because equal member counts are not enough on their own: an engine
 * that records a type's name without looking through it documents exactly as many members as one
 * that expanded the whole chain, off a fraction of the work.
 */
export type Comparability =
  | 'unknown'
  | 'like-for-like'
  | 'next-documents-more'
  | 'next-documents-less'
  | 'next-resolves-more'
  | 'next-resolves-less';

/**
 * One control pair's comparison for one scenario: the legacy engine's median over the new engine's,
 * both measured in the same invocation.
 *
 * Cold and warm carry their own verdict because they are independent measurements - a pair can
 * document the same members cold and different ones on the save it was timed on.
 */
export interface RatioEntry {
  /** Numerator of the ratio. */
  legacyEngine: EngineId;
  /** Denominator of the ratio - the engine a budget would protect. */
  nextEngine: EngineId;
  cold?: number;
  warm?: number;
  legacyColdMembers?: number;
  nextColdMembers?: number;
  legacyWarmMembers?: number;
  nextWarmMembers?: number;
  coldComparability: Comparability;
  warmComparability: Comparability;
  /**
   * The versions the two sides resolved to. Only meaningful for a pair whose sides are the same
   * package, where two equal versions mean nothing was compared at all.
   */
  legacyVersion?: string;
  nextVersion?: string;
}

/** Keyed by control-pair name, then by scenario name. */
export type Ratios = Record<string, Record<string, RatioEntry>>;

export interface SuiteResults {
  generatedAt: string;
  nodeVersion: string;
  /** The one pinned N; numbers taken at different N are not comparable. */
  pinnedN: number;
  /** False for --quick smoke runs, whose numbers must never be compared against real runs. */
  comparable: boolean;
  /** Resolved versions of externally-installed engines, when they ran. */
  engineVersions: Partial<Record<EngineId, string>>;
  engines: Partial<Record<EngineId, EngineResult>>;
  ratios: Ratios;
}
