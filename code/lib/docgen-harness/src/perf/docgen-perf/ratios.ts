/**
 * The calibration references: each framework's legacy-engine median divided by its new-engine
 * median, both measured in the same invocation. Ratios stand in for absolute milliseconds because
 * wall-clock on shared CI executors is too noisy to gate (PERF-METHODOLOGY.md, "Budget shape").
 */
import type {
  Comparability,
  EngineId,
  EngineResult,
  Metric,
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
  {
    name: 'vue-component-meta-version',
    legacy: 'vue-component-meta',
    next: 'vue-component-meta-next',
  },
];

/**
 * Even repetitions run the engines back to front, so cache warming and thermal drift do not
 * consistently favour whichever side of a pair is listed first.
 *
 * Reversing the whole list rather than swapping each pair in place is what makes that hold for
 * *every* pair at once. Pairs can share an engine - `vue-component-meta` is the new side of the vue
 * pair and the legacy side of the version pair - and swapping such a chain pairwise moves the shared
 * engine twice, which puts the first pair back in its original relative order.
 */
export function engineOrderForRep(engines: EngineId[], rep: number): EngineId[] {
  return rep % 2 === 0 ? [...engines].reverse() : [...engines];
}

/**
 * Undefined unless both sides measured: dividing by a skipped or failed side is not a comparison.
 *
 * A zero denominator is treated the same way. It means the new engine's median landed below the
 * clock's resolution, and Infinity would then be rendered and stored as if it were a ratio.
 */
function medianRatio(legacy: Metric, next: Metric) {
  if (legacy.status !== 'measured' || next.status !== 'measured') {
    return undefined;
  }
  const ratio = legacy.value / next.value;
  return Number.isFinite(ratio) ? ratio : undefined;
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
  pair: ControlPair,
  legacy: ScenarioResult,
  next: ScenarioResult,
  versions: PairVersions
): RatioEntry {
  return {
    legacyEngine: pair.legacy,
    nextEngine: pair.next,
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
      ratios[pair.name][scenarioName] = ratioFor(pair, legacyScenario, nextScenario, versions);
    }
  }

  return ratios;
}
