/**
 * The calibration references: each framework's legacy-engine median divided by its new-engine
 * median, both measured in the same invocation. Ratios stand in for absolute milliseconds because
 * wall-clock on shared CI executors is too noisy to gate (PERF-METHODOLOGY.md, "Budget shape").
 */
import type {
  EngineId,
  EngineResult,
  LatencyMetric,
  NotApplicable,
  RatioEntry,
  Ratios,
  ScenarioResult,
} from './types.ts';

interface ControlPair {
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

/** Undefined unless both sides measured: dividing by a skipped or failed side is not a comparison. */
function medianRatio(legacy: LatencyMetric | NotApplicable, next: LatencyMetric | NotApplicable) {
  return legacy.status === 'measured' && next.status === 'measured'
    ? legacy.median / next.median
    : undefined;
}

/**
 * Undefined, not false, when an engine reports no member counts - see renderRatios for why that
 * distinction matters.
 */
function likeForLike(legacy: ScenarioResult, next: ScenarioResult): boolean | undefined {
  if (legacy.coldMembers === undefined || next.coldMembers === undefined) {
    return undefined;
  }
  const warmAgrees =
    legacy.warmMembers === undefined ||
    next.warmMembers === undefined ||
    legacy.warmMembers === next.warmMembers;
  return legacy.coldMembers === next.coldMembers && warmAgrees;
}

function ratioFor(legacy: ScenarioResult, next: ScenarioResult): RatioEntry {
  return {
    cold: medianRatio(legacy.metrics.coldExtractionMs, next.metrics.coldExtractionMs),
    warm: medianRatio(legacy.metrics.warmExtractionMs, next.metrics.warmExtractionMs),
    legacyColdMembers: legacy.coldMembers,
    nextColdMembers: next.coldMembers,
    legacyWarmMembers: legacy.warmMembers,
    nextWarmMembers: next.warmMembers,
    likeForLike: likeForLike(legacy, next),
  };
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
