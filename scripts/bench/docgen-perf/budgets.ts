/**
 * Budget values shared between the docgen-memory gate and the per-engine perf suite. Budgets are
 * derived per engine from that engine's own baseline runs and are never ported between engines;
 * missing engines get their rows when their baselines are recorded.
 */
import type { EngineId } from './types.ts';

export interface MemoryBudgets {
  /** Max allowed post-GC retained growth (MB) across the run. */
  maxRetainedGrowthMb: number;
  /** Max allowed average transient working set added per save (MB). */
  maxTransientMb: number;
  /** Max allowed post-GC retained-heap slope (MB/save). */
  maxRetainedSlopeMb: number;
}

/**
 * Budgets sit well above observed values so the gate is not flaky, while still failing hard on a
 * real regression.
 */
export const MEMORY_BUDGETS: Partial<Record<EngineId, MemoryBudgets>> = {
  'react-osa': { maxRetainedGrowthMb: 60, maxTransientMb: 90, maxRetainedSlopeMb: 3 },
};
