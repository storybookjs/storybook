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
