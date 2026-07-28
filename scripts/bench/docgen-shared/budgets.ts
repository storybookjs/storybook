/**
 * Memory budget values for the engine gates. Budgets are derived per engine from that engine's own
 * baseline runs and are never ported between engines; missing engines get their rows when their
 * baselines are recorded.
 */
import type { EngineId } from './engine-ids.ts';

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

/**
 * Budgets for `engine`, or a hard failure. A gate that reads a missing row would assert nothing and
 * still pass, so an engine without recorded budgets must not reach a gate config at all.
 */
export function memoryBudgetsFor(engine: EngineId): MemoryBudgets {
  const budgets = MEMORY_BUDGETS[engine];
  if (!budgets) {
    throw new Error(`no memory budgets recorded for "${engine}"`);
  }
  return budgets;
}
