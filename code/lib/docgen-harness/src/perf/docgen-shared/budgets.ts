import type { EngineId } from './engine-ids.ts';

/**
 * Absolute memory ceilings, in megabytes. Shared by both gates: a megabyte is a megabyte regardless
 * of how busy the machine is, which is what makes memory safe to gate on where wall clock is not.
 */
export interface MemoryBudgets {
  /** Max allowed average transient working set added per save (MB). */
  maxTransientMb: number;
  /** Max allowed post-GC retained growth (MB) across the run. */
  maxRetainedGrowthMb: number;
  /** Max allowed post-GC retained-heap slope (MB/save). */
  maxRetainedSlopeMb: number;
}

const MEMORY_BUDGETS: Partial<Record<EngineId, MemoryBudgets>> = {
  'react-osa': { maxTransientMb: 90, maxRetainedGrowthMb: 60, maxRetainedSlopeMb: 3 },
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
 * noisy to gate on (PERF-METHODOLOGY.md, "Budget shape"). The one timing budget here is a ratio
 * between two figures from the same run on the same machine, which is the only comparison the
 * methodology allows.
 *
 * Cross-engine ratios carry no budget today, because no control pair has been certified as doing
 * equal work; PERF-METHODOLOGY.md records why. That check belongs with the first pair that earns
 * it, not with a placeholder here.
 */
export interface PerfBudget {
  /**
   * Ceiling on warm median over cold median for this engine. Like-for-like by construction - both
   * figures come from one process over one project - and it rises exactly when a save stops being
   * re-extracted incrementally.
   */
  maxWarmColdRatio?: number;
  memory?: Partial<MemoryBudgets>;
}

/** `engine/scenario`, exactly as the suite reports a result, with the engine id checked. */
export type PerfBudgetKey = `${EngineId}/${string}`;

/**
 * Every number here was measured on CI, with headroom over the observed value; the run they came
 * from is recorded in PERF-METHODOLOGY.md.
 */
export const PERF_BUDGETS: Partial<Record<PerfBudgetKey, PerfBudget>> = {
  // No first-story rows yet: that shape lands with this change and its budgets follow the first CI
  // run that measures it, rather than being guessed from a laptop.
  //
  // Warm here is ~14ms against a ~1.9s cold pass, so the ratio has room to move on a noisy
  // executor without meaning anything; the budget sits far enough above it to survive that and
  // still catch a save that stopped being re-extracted incrementally.
  'react-legacy/whole-index': {
    maxWarmColdRatio: 0.05,
    memory: { maxTransientMb: 15, maxRetainedGrowthMb: 30, maxRetainedSlopeMb: 1 },
  },
  // The docgen-memory gate protects this engine's retained heap under its own, much heavier
  // workload; what this row adds is the incremental re-extraction the suite measures.
  //
  // Growth is negative here - the engine releases its whole-project state on the first save and
  // settles ~85MB below the cold pass - so the ceiling is only ever met from far below. The slope
  // is what carries the leak signal, and it is tight because the steady state is genuinely flat.
  'react-osa/whole-index': {
    maxWarmColdRatio: 0.08,
    memory: { maxTransientMb: 45, maxRetainedGrowthMb: 60, maxRetainedSlopeMb: 0.5 },
  },
  'vue-docgen-api/flat': {
    maxWarmColdRatio: 0.08,
    memory: { maxTransientMb: 8, maxRetainedGrowthMb: 10, maxRetainedSlopeMb: 1 },
  },
  'vue-docgen-api/workspace': {
    maxWarmColdRatio: 0.1,
    memory: { maxTransientMb: 8, maxRetainedGrowthMb: 10, maxRetainedSlopeMb: 1 },
  },
  // Touching a widely-imported base type costs every engine more per save, so this scenario's
  // ratio is allowed to sit higher than the same engine's other two.
  'vue-docgen-api/base-type-touch': {
    maxWarmColdRatio: 0.25,
    memory: { maxTransientMb: 8, maxRetainedGrowthMb: 10, maxRetainedSlopeMb: 1 },
  },
  'vue-component-meta/flat': {
    maxWarmColdRatio: 0.2,
    memory: { maxTransientMb: 40, maxRetainedGrowthMb: 20, maxRetainedSlopeMb: 1.5 },
  },
  'vue-component-meta/workspace': {
    maxWarmColdRatio: 0.22,
    memory: { maxTransientMb: 40, maxRetainedGrowthMb: 20, maxRetainedSlopeMb: 1.5 },
  },
  'vue-component-meta/base-type-touch': {
    maxWarmColdRatio: 0.25,
    memory: { maxTransientMb: 40, maxRetainedGrowthMb: 20, maxRetainedSlopeMb: 1.5 },
  },
  // No incrementality budget: compodoc re-runs the whole project on every invocation by design, so
  // its warm figure is its cold figure and a ratio around one is correct behaviour, not a
  // regression. Peak memory is the thing worth watching - it is an order of magnitude above every
  // other engine here.
  'compodoc/default': {
    memory: { maxTransientMb: 400 },
  },
};
