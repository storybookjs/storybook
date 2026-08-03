import type { EngineId } from './engine-ids.ts';

export interface MemoryBudgets {
  /** Max allowed post-GC retained growth (MB) across the run. */
  maxRetainedGrowthMb: number;
  /** Max allowed average transient working set added per save (MB). */
  maxTransientMb: number;
  /** Max allowed post-GC retained-heap slope (MB/save). */
  maxRetainedSlopeMb: number;
}

const MEMORY_BUDGETS: Partial<Record<EngineId, MemoryBudgets>> = {
  'react-osa': { maxRetainedGrowthMb: 60, maxTransientMb: 90, maxRetainedSlopeMb: 3 },
};

export function memoryBudgetsFor(engine: EngineId): MemoryBudgets {
  const budgets = MEMORY_BUDGETS[engine];
  if (!budgets) {
    throw new Error(`no memory budgets recorded for "${engine}"`);
  }
  return budgets;
}

/**
 * What the perf suite's gate asserts, for one engine on one scenario.
 *
 * Timing never appears as a ceiling on milliseconds: wall clock on a shared executor is far too
 * noisy to gate on (PERF-METHODOLOGY.md, "Budget shape"). It appears as a ratio between two figures
 * from the same run on the same machine, which is the only comparison the methodology allows.
 *
 * Memory stays absolute, with headroom, for the same reason the docgen-memory gate does: a megabyte
 * is a megabyte regardless of how busy the machine is.
 */
export interface PerfBudget {
  /**
   * Ceiling on warm median over cold median for this engine. Like-for-like by construction - both
   * figures come from one process over one project - and it rises exactly when a save stops being
   * re-extracted incrementally.
   */
  maxWarmColdRatio?: number;
  /**
   * Floor on the cross-engine ratio from a control pair, for an engine that has a reference
   * implementation to be measured against. Only a pair the suite certified as like-for-like may
   * carry one, so an engine whose pair documents different amounts of the type graph has no row
   * here and the gap is recorded in PERF-METHODOLOGY.md instead.
   */
  reference?: {
    pair: string;
    minColdRatio?: number;
    minWarmRatio?: number;
  };
  memory?: {
    maxPeakTransientMb?: number;
    maxRetainedGrowthMb?: number;
    maxRetainedSlopeMbPerSave?: number;
  };
}

/**
 * Keyed `engine/scenario`, matching how the suite reports its results. Every number here was
 * measured on CI, with headroom over the observed value; the run they came from is recorded in
 * PERF-METHODOLOGY.md.
 */
export const PERF_BUDGETS: Record<string, PerfBudget> = {
  // Warm here is ~14ms against a ~1.9s cold pass, so the ratio has room to move on a noisy
  // executor without meaning anything; the budget sits far enough above it to survive that and
  // still catch a save that stopped being re-extracted incrementally.
  'react-legacy/default': {
    maxWarmColdRatio: 0.05,
    memory: { maxPeakTransientMb: 15, maxRetainedGrowthMb: 30, maxRetainedSlopeMbPerSave: 1 },
  },
  // The docgen-memory gate protects this engine's retained heap under its own, much heavier
  // workload; what this row adds is the incremental re-extraction the suite measures.
  'react-osa/default': {
    maxWarmColdRatio: 0.08,
    memory: { maxPeakTransientMb: 45, maxRetainedGrowthMb: 60, maxRetainedSlopeMbPerSave: 3 },
  },
  'vue-docgen-api/flat': {
    maxWarmColdRatio: 0.08,
    memory: { maxPeakTransientMb: 8, maxRetainedGrowthMb: 10, maxRetainedSlopeMbPerSave: 1 },
  },
  'vue-docgen-api/workspace': {
    maxWarmColdRatio: 0.1,
    memory: { maxPeakTransientMb: 8, maxRetainedGrowthMb: 10, maxRetainedSlopeMbPerSave: 1 },
  },
  // Touching a widely-imported base type costs every engine more per save, so this scenario's
  // ratio is allowed to sit higher than the same engine's other two.
  'vue-docgen-api/base-type-touch': {
    maxWarmColdRatio: 0.25,
    memory: { maxPeakTransientMb: 8, maxRetainedGrowthMb: 10, maxRetainedSlopeMbPerSave: 1 },
  },
  'vue-component-meta/flat': {
    maxWarmColdRatio: 0.2,
    memory: { maxPeakTransientMb: 40, maxRetainedGrowthMb: 20, maxRetainedSlopeMbPerSave: 1.5 },
  },
  'vue-component-meta/workspace': {
    maxWarmColdRatio: 0.22,
    memory: { maxPeakTransientMb: 40, maxRetainedGrowthMb: 20, maxRetainedSlopeMbPerSave: 1.5 },
  },
  'vue-component-meta/base-type-touch': {
    maxWarmColdRatio: 0.25,
    memory: { maxPeakTransientMb: 40, maxRetainedGrowthMb: 20, maxRetainedSlopeMbPerSave: 1.5 },
  },
  // No incrementality budget: compodoc re-runs the whole project on every invocation by design, so
  // its warm figure is its cold figure and a ratio around one is correct behaviour, not a
  // regression. Peak memory is the thing worth watching - it is an order of magnitude above every
  // other engine here.
  'compodoc/default': {
    memory: { maxPeakTransientMb: 400 },
  },
};
