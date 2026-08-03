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

/** Observed at 0.4-0.9MB transient, 0.1-0.2MB growth and 0.01-0.02MB/save across the three scenarios. */
const VUE_DOCGEN_API_MEMORY = {
  maxTransientMb: 4,
  maxRetainedGrowthMb: 3,
  maxRetainedSlopeMb: 0.2,
};

/** Measured on CI with headroom; the run is recorded in PERF-METHODOLOGY.md. */
export const PERF_BUDGETS: Partial<Record<PerfBudgetKey, PerfBudget>> = {
  // Warm is ~13ms against a ~1.7s cold pass, so the ratio moves easily on a noisy executor; the
  // budget sits far enough above it to survive that.
  //
  // Growth is a ceiling, not a multiple of the observed -4.1MB: what is worth catching is this run
  // ending above the baseline it started from, so the budget sits just above zero.
  'react-legacy/whole-index': {
    maxWarmColdRatio: 0.05,
    memory: { maxTransientMb: 15, maxRetainedGrowthMb: 2, maxRetainedSlopeMb: 0.1 },
  },
  // A one-component cold pass is only ~96ms, so warm/cold sits an order of magnitude higher than
  // the index shape's without anything being wrong; the ratio still catches a warm pass that stops
  // being incremental. Growth and slope are positive here because every save grows the one
  // component's type - see PERF-METHODOLOGY.md, "Recorded baselines".
  'react-legacy/first-story': {
    maxWarmColdRatio: 0.6,
    memory: { maxTransientMb: 15, maxRetainedGrowthMb: 10, maxRetainedSlopeMb: 1 },
  },
  // Growth is negative here: the engine releases its whole-project state on the first save and
  // settles ~83MB below the cold pass, so the slope is what carries the leak signal.
  //
  // The growth budget is negative for that reason. A positive ceiling would pass the very
  // regression this row exists to catch - an engine that stopped releasing that state lands near
  // 0MB growth - so the budget asserts the drop still happens rather than bounding a rise.
  'react-osa/whole-index': {
    maxWarmColdRatio: 0.08,
    memory: { maxTransientMb: 45, maxRetainedGrowthMb: -50, maxRetainedSlopeMb: 0.5 },
  },
  // The engine still builds a program for one component, so cold stays ~1.1s and the ratio looks
  // like the index shape's. Its cold cost against react-legacy's is the finding, not this budget.
  'react-osa/first-story': {
    maxWarmColdRatio: 0.15,
    memory: { maxTransientMb: 30, maxRetainedGrowthMb: 10, maxRetainedSlopeMb: 1 },
  },
  // This engine keeps no cache, so every figure is a fraction of a megabyte and the budgets are
  // set against the largest of the three scenarios rather than each row's own number. Even so they
  // fail long before anything at this scale matters: a leak here would be tens of megabytes.
  'vue-docgen-api/flat': {
    maxWarmColdRatio: 0.08,
    memory: VUE_DOCGEN_API_MEMORY,
  },
  'vue-docgen-api/workspace': {
    maxWarmColdRatio: 0.1,
    memory: VUE_DOCGEN_API_MEMORY,
  },
  // Touching a widely-imported base type costs more per save, so this ratio sits higher.
  'vue-docgen-api/base-type-touch': {
    maxWarmColdRatio: 0.25,
    memory: VUE_DOCGEN_API_MEMORY,
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
  //
  // The tightest row in the table at under twice its observation, because this is a whole-process
  // RSS peak rather than a delta: two CI runs read 213.8MB and 216.0MB. Loosen it only against a
  // run that actually flaked, not on the grounds that the multiple looks small.
  'compodoc/default': {
    memory: { maxTransientMb: 400 },
  },
};
