// Ratios stand in for absolute milliseconds because wall-clock on shared CI executors is too noisy
// to gate. See PERF-METHODOLOGY.md, "Budget shape".
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
  // Key under which this pair's ratios appear in the results.
  name: string;
  legacy: EngineId;
  next: EngineId;
  // The two sides count different things on a save, so their warm member counts say nothing about
  // whether the ratio is like-for-like and are left out rather than compared.
  warmScopeDiffers?: true;
}

// A pair whose engines are not both registered yields no ratio, so a pair may be listed before the
// engines behind it land.
export const CONTROL_PAIRS: ControlPair[] = [
  { name: 'react', legacy: 'react-legacy', next: 'react-osa' },
  { name: 'vue', legacy: 'vue-docgen-api', next: 'vue-component-meta' },
  // compodoc's warm pass re-documents the whole project; the analyzer re-extracts the one component
  // that changed.
  {
    name: 'angular',
    legacy: 'compodoc',
    next: 'angular-component-meta',
    warmScopeDiffers: true,
  },
  {
    name: 'vue-component-meta-version',
    legacy: 'vue-component-meta',
    next: 'vue-component-meta-next',
  },
];

// Even repetitions run the engines back to front, so cache warming and thermal drift do not
// consistently favour whichever side of a pair is listed first. Reversing the whole list rather than
// swapping each pair in place is what makes that hold for pairs that share an engine.
export function engineOrderForRep(engines: EngineId[], rep: number): EngineId[] {
  return rep % 2 === 0 ? [...engines].reverse() : [...engines];
}

// Undefined unless both sides measured, and for a zero denominator too: an Infinity would be
// rendered and stored as if it were a ratio.
function medianRatio(legacy: Metric, next: Metric) {
  if (legacy.status !== 'measured' || next.status !== 'measured') {
    return undefined;
  }
  const ratio = legacy.value / next.value;
  return Number.isFinite(ratio) ? ratio : undefined;
}

// Member counts settle it whenever they differ; the opaque-type counts only break a tie, because
// documenting a type's name without looking through it is the case a member count cannot see.
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
  const warmMembers: Pick<RatioEntry, 'legacyWarmMembers' | 'nextWarmMembers'> =
    pair.warmScopeDiffers
      ? {}
      : { legacyWarmMembers: legacy.warmMembers, nextWarmMembers: next.warmMembers };

  return {
    legacyEngine: pair.legacy,
    nextEngine: pair.next,
    cold: medianRatio(legacy.metrics.coldExtractionMs, next.metrics.coldExtractionMs),
    warm: medianRatio(legacy.metrics.warmExtractionMs, next.metrics.warmExtractionMs),
    legacyColdMembers: legacy.coldMembers,
    nextColdMembers: next.coldMembers,
    ...warmMembers,
    coldComparability: comparability(
      legacy.coldMembers,
      next.coldMembers,
      legacy.coldOpaqueTypes,
      next.coldOpaqueTypes
    ),
    // No engine reports opaque types for the re-extracted member, so warm is judged on counts alone.
    // Omitted counts yield `unknown`, which is what a differing warm scope must report.
    warmComparability: comparability(warmMembers.legacyWarmMembers, warmMembers.nextWarmMembers),
    ...versions,
  };
}

interface PairVersions {
  legacyVersion?: string;
  nextVersion?: string;
}

// Resolved versions ride along because a range on one side can land both sides on the same version,
// and a ratio taken against itself must not read as a clean result.
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
