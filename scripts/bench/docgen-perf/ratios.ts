/**
 * The calibration references: each framework's legacy-engine median divided by its new-engine
 * median, both measured in the same invocation. Ratios stand in for absolute milliseconds because
 * wall-clock on shared CI executors is too noisy to gate (PERF-METHODOLOGY.md, "Budget shape").
 */
import type {
  Comparability,
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

// A pair whose engines are not both registered yields no ratio, so a pair may be listed before the
// engines behind it land.
export const CONTROL_PAIRS: ControlPair[] = [
  { name: 'react', legacy: 'react-legacy', next: 'react-osa' },
  { name: 'vue', legacy: 'vue-docgen-api', next: 'vue-component-meta' },
  { name: 'vue-component-meta-version', legacy: 'vue-component-meta', next: 'vue-component-meta-next' },
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
 * Member counts decide first, and any difference there settles it. Only once they agree does the
 * count of types an engine never looked through get a say, which is the case a member count on its
 * own cannot see.
 *
 * A missing count on either side yields `unknown` rather than a verdict. Treating it as agreement
 * would mark a pair like-for-like on the strength of a number nobody measured.
 */
function comparability(
  legacyMembers: number | undefined,
  nextMembers: number | undefined,
  legacyOpaque?: number,
  nextOpaque?: number
): Comparability {
  if (legacyMembers === undefined || nextMembers === undefined) {
    return 'unknown';
  }
  if (nextMembers !== legacyMembers) {
    return nextMembers > legacyMembers ? 'next-documents-more' : 'next-documents-less';
  }
  if (legacyOpaque === undefined || nextOpaque === undefined || nextOpaque === legacyOpaque) {
    return 'like-for-like';
  }
  return nextOpaque > legacyOpaque ? 'next-resolves-less' : 'next-resolves-more';
}

function ratioFor(
  legacy: ScenarioResult,
  next: ScenarioResult,
  versions: PairVersions
): RatioEntry {
  return {
    cold: medianRatio(legacy.metrics.coldExtractionMs, next.metrics.coldExtractionMs),
    warm: medianRatio(legacy.metrics.warmExtractionMs, next.metrics.warmExtractionMs),
    legacyColdMembers: legacy.coldMembers,
    nextColdMembers: next.coldMembers,
    legacyWarmMembers: legacy.warmMembers,
    nextWarmMembers: next.warmMembers,
    coldComparability: comparability(
      legacy.coldMembers,
      next.coldMembers,
      legacy.coldOpaqueTypes,
      next.coldOpaqueTypes
    ),
    // No engine reports opaque types for the re-extracted member, so warm is judged on counts alone.
    warmComparability: comparability(legacy.warmMembers, next.warmMembers),
    ...versions,
  };
}

interface PairVersions {
  legacyVersion?: string;
  nextVersion?: string;
}

/**
 * Ratios for every control pair whose two engines both measured in this invocation. A pair with one
 * failed or skipped side yields nothing: dividing a fresh median by a stale one is not a comparison.
 *
 * Resolved versions ride along because a pair can have both sides land on the same version - a
 * range on one side is enough - and a ratio of one taken against itself must not read as a clean
 * result.
 */
export function computeRatios(
  results: Partial<Record<EngineId, EngineResult>>,
  engineVersions: Partial<Record<EngineId, string>> = {}
): Ratios {
  const ratios: Ratios = {};

  for (const pair of CONTROL_PAIRS) {
    const legacy = results[pair.legacy];
    const next = results[pair.next];
    if (legacy?.status !== 'measured' || next?.status !== 'measured') {
      continue;
    }
    const versions: PairVersions = {
      legacyVersion: engineVersions[pair.legacy],
      nextVersion: engineVersions[pair.next],
    };
    for (const [scenarioName, legacyScenario] of Object.entries(legacy.scenarios)) {
      const nextScenario = next.scenarios[scenarioName];
      if (!nextScenario) {
        continue;
      }
      ratios[pair.name] ??= {};
      ratios[pair.name][scenarioName] = ratioFor(legacyScenario, nextScenario, versions);
    }
  }

  return ratios;
}
