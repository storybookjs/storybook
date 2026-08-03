import type { EngineId } from './engine-ids.ts';

/** Absolute memory ceilings, in megabytes. Shared by both gates. */
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
 * What the perf gate asserts for one engine on one scenario.
 *
 * Timing is never a ceiling on milliseconds: wall clock on a shared executor is too noisy to gate
 * on (PERF-METHODOLOGY.md, "Budget shape"). Cross-engine ratios carry no budget today because no
 * control pair does equal work; that check belongs with the first pair that earns one.
 */
export interface PerfBudget {
  /** Ceiling on warm median over cold median: it rises when a save stops re-extracting incrementally. */
  maxWarmColdRatio?: number;
  memory?: Partial<MemoryBudgets>;
}

/** `engine/scenario`, exactly as the suite reports a result, with the engine id checked. */
export type PerfBudgetKey = `${EngineId}/${string}`;

/** Measured on CI with headroom; the run is recorded in PERF-METHODOLOGY.md. */
export const PERF_BUDGETS: Partial<Record<PerfBudgetKey, PerfBudget>> = {
  // No first-story rows yet: those budgets follow the first CI run that measures the shape.
  //
  // Warm is ~14ms against a ~1.9s cold pass, so the ratio moves easily on a noisy executor; the
  // budget sits far enough above it to survive that.
  'react-legacy/whole-index': {
    maxWarmColdRatio: 0.05,
    memory: { maxTransientMb: 15, maxRetainedGrowthMb: 30, maxRetainedSlopeMb: 1 },
  },
  // Growth is negative here: the engine releases its whole-project state on the first save and
  // settles ~85MB below the cold pass, so the slope is what carries the leak signal.
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
  // Touching a widely-imported base type costs more per save, so this ratio sits higher.
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
  // No incrementality budget: compodoc re-runs the whole project every invocation by design, so its
  // warm figure is its cold figure. Peak memory is what is worth watching.
  'compodoc/default': {
    memory: { maxTransientMb: 400 },
  },
};
