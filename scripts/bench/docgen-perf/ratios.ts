/**
 * The calibration references: each framework's legacy-engine median divided by its new-engine
 * median, both measured in the same invocation. Ratios stand in for absolute milliseconds because
 * wall-clock on shared CI executors is too noisy to gate (PERF-METHODOLOGY.md, "Budget shape").
 */
import type { EngineId } from '../docgen-shared/engine-ids.ts';
import type { EngineResult, RatioEntry, Ratios, ScenarioResult } from './types.ts';

export interface ControlPair {
  /** Key under which this pair's ratios appear in the results. */
  name: string;
  legacy: EngineId;
  next: EngineId;
}

export const CONTROL_PAIRS: ControlPair[] = [
  { name: 'react', legacy: 'react-legacy', next: 'react-osa' },
  { name: 'vue', legacy: 'vue-docgen-api', next: 'vue-component-meta' },
];

/**
 * Each control pair swaps sides on even repetitions so cache warming and thermal drift do not
 * consistently favour whichever engine is listed first.
 */
export function engineOrderForRep(engines: EngineId[], rep: number): EngineId[] {
  const order = [...engines];
  if (rep % 2 !== 0) {
    return order;
  }
  for (const { legacy, next } of CONTROL_PAIRS) {
    const legacyIdx = order.indexOf(legacy);
    const nextIdx = order.indexOf(next);
    if (legacyIdx >= 0 && nextIdx >= 0) {
      order[legacyIdx] = next;
      order[nextIdx] = legacy;
    }
  }
  return order;
}

function ratioFor(legacy: ScenarioResult, next: ScenarioResult): RatioEntry {
  const entry: RatioEntry = {
    legacyColdMembers: legacy.coldMembers,
    nextColdMembers: next.coldMembers,
    legacyWarmMembers: legacy.warmMembers,
    nextWarmMembers: next.warmMembers,
  };

  if (
    legacy.metrics.coldExtractionMs.status === 'measured' &&
    next.metrics.coldExtractionMs.status === 'measured'
  ) {
    entry.cold = legacy.metrics.coldExtractionMs.median / next.metrics.coldExtractionMs.median;
  }
  if (
    legacy.metrics.warmExtractionMs.status === 'measured' &&
    next.metrics.warmExtractionMs.status === 'measured'
  ) {
    entry.warm = legacy.metrics.warmExtractionMs.median / next.metrics.warmExtractionMs.median;
  }

  // likeForLike is left undefined, not false, when an engine reports no member counts - see
  // renderRatios for why that distinction matters.
  if (legacy.coldMembers !== undefined && next.coldMembers !== undefined) {
    const warmAgrees =
      legacy.warmMembers === undefined ||
      next.warmMembers === undefined ||
      legacy.warmMembers === next.warmMembers;
    entry.likeForLike = legacy.coldMembers === next.coldMembers && warmAgrees;
  }

  return entry;
}

/**
 * Ratios for every control pair whose two engines both measured in this invocation. A pair with one
 * failed or skipped side yields nothing: dividing a fresh median by a stale one is not a comparison.
 */
export function computeRatios(results: Partial<Record<EngineId, EngineResult>>): Ratios {
  const ratios: Ratios = {};

  for (const pair of CONTROL_PAIRS) {
    const legacy = results[pair.legacy];
    const next = results[pair.next];
    if (legacy?.status !== 'measured' || next?.status !== 'measured') {
      continue;
    }
    for (const [scenarioName, legacyScenario] of Object.entries(legacy.scenarios)) {
      const nextScenario = next.scenarios[scenarioName];
      if (!nextScenario) {
        continue;
      }
      ratios[pair.name] ??= {};
      ratios[pair.name][scenarioName] = ratioFor(legacyScenario, nextScenario);
    }
  }

  return ratios;
}
