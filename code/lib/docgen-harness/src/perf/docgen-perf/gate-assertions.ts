/**
 * Turns one suite run into a pass/fail verdict against the recorded budgets.
 *
 * Kept free of process and filesystem work so the rules below - which are the whole point of the
 * gate - can be tested against hand-built results instead of a full run.
 */
import { PERF_BUDGETS, type PerfBudget } from '../docgen-shared/budgets.ts';
import type { Comparability, EngineId, EngineMetrics, SuiteResults } from './types.ts';

export interface Assertion {
  label: string;
  ok: boolean;
  /** Why it failed. Absent on a pass. */
  detail?: string;
}

function splitKey(key: string): { engine: EngineId; scenario: string } {
  const [engine, ...rest] = key.split('/');
  return { engine: engine as EngineId, scenario: rest.join('/') };
}

/**
 * A cross-engine ratio only becomes a verdict when both sides did equal work. Anything else is a
 * behaviour change wearing a performance number, and passing it through as if it were comparable is
 * how a regression gets waved past.
 */
function likeForLike(verdict: Comparability): boolean {
  return verdict === 'like-for-like';
}

function measuredMedian(metric: EngineMetrics[keyof EngineMetrics]): number | undefined {
  return metric.status === 'measured' && 'median' in metric ? metric.median : undefined;
}

/**
 * Warm over cold, for one engine, from one run.
 *
 * This is the budget that does not need a second engine to mean something: both sides come from the
 * same process on the same machine over the same project, so it is like-for-like by construction.
 * It rises when re-extraction after a save stops being incremental and starts redoing the cold
 * pass's work, which is the docgen regression that actually hurts users.
 */
function checkIncrementality(
  key: string,
  max: number,
  metrics: EngineMetrics,
  assertions: Assertion[]
): void {
  const label = `${key} warm/cold ratio`;
  const cold = measuredMedian(metrics.coldExtractionMs);
  const warm = measuredMedian(metrics.warmExtractionMs);

  if (cold === undefined || warm === undefined || cold === 0) {
    assertions.push({ label, ok: false, detail: 'cold and warm were not both measured' });
    return;
  }
  const ratio = warm / cold;
  assertions.push({
    label,
    ok: ratio <= max,
    detail:
      ratio <= max
        ? undefined
        : `${ratio.toFixed(3)} exceeds the budget of ${max}; re-extraction after a save is no longer incremental`,
  });
}

function checkReference(
  key: string,
  scenario: string,
  reference: NonNullable<PerfBudget['reference']>,
  results: SuiteResults,
  assertions: Assertion[]
): void {
  const entry = results.ratios[reference.pair]?.[scenario];
  if (!entry) {
    assertions.push({
      label: `${key} reference ratio`,
      ok: false,
      detail: `control pair "${reference.pair}" produced no ratio for this scenario; both sides must measure in one run`,
    });
    return;
  }

  const checks = [
    {
      metric: 'cold',
      ratio: entry.cold,
      min: reference.minColdRatio,
      verdict: entry.coldComparability,
    },
    {
      metric: 'warm',
      ratio: entry.warm,
      min: reference.minWarmRatio,
      verdict: entry.warmComparability,
    },
  ] as const;

  for (const { metric, ratio, min, verdict } of checks) {
    if (min === undefined) {
      continue;
    }
    const label = `${key} ${metric} reference ratio`;
    if (ratio === undefined) {
      assertions.push({ label, ok: false, detail: 'not measured in this run' });
      continue;
    }
    if (!likeForLike(verdict)) {
      assertions.push({
        label,
        ok: false,
        detail: `the two sides did not do equal work (${verdict}), so ${ratio.toFixed(2)} is not a cost comparison`,
      });
      continue;
    }
    assertions.push({
      label,
      ok: ratio >= min,
      detail: ratio >= min ? undefined : `${ratio.toFixed(2)} is below the budget of ${min}`,
    });
  }
}

function checkMemory(
  key: string,
  memory: NonNullable<PerfBudget['memory']>,
  metrics: EngineMetrics,
  assertions: Assertion[]
): void {
  const peak = metrics.peakTransientMb;
  const growth = metrics.retainedGrowthMb;
  const slope = metrics.retainedSlopeMbPerSave;

  const checks: Array<{ metric: string; value: number | undefined; max: number | undefined }> = [
    {
      metric: 'peak transient (MB)',
      value: peak.status === 'measured' ? peak.mean : undefined,
      max: memory.maxPeakTransientMb,
    },
    {
      metric: 'retained growth (MB)',
      value: growth.status === 'measured' ? growth.value : undefined,
      max: memory.maxRetainedGrowthMb,
    },
    {
      metric: 'retained slope (MB/save)',
      value: slope.status === 'measured' ? slope.value : undefined,
      max: memory.maxRetainedSlopeMbPerSave,
    },
  ];

  for (const { metric, value, max } of checks) {
    if (max === undefined) {
      continue;
    }
    const label = `${key} ${metric}`;
    if (value === undefined) {
      // A budgeted metric reported n/a means the run did not produce the thing being gated on.
      assertions.push({ label, ok: false, detail: 'not measured in this run' });
      continue;
    }
    assertions.push({
      label,
      ok: value <= max,
      detail: value <= max ? undefined : `${value.toFixed(1)} exceeds the budget of ${max}`,
    });
  }
}

/**
 * Every assertion the gate makes about one run, in the order it should be printed.
 *
 * Two whole-run rules come first, because either one invalidates everything after it: a run whose
 * numbers are marked non-comparable (the `--quick` smoke profile) must never report a green gate,
 * and a budget table with no rows asserts nothing while looking like protection.
 */
export function assertBudgets(
  results: SuiteResults,
  budgets: Record<string, PerfBudget> = PERF_BUDGETS
): Assertion[] {
  const assertions: Assertion[] = [];

  if (!results.comparable) {
    return [
      {
        label: 'run is comparable',
        ok: false,
        detail: 'these are non-comparable smoke numbers; the gate needs a full-profile run',
      },
    ];
  }
  assertions.push({ label: 'run is comparable', ok: true });

  const keys = Object.keys(budgets);
  if (keys.length === 0) {
    return [
      ...assertions,
      {
        label: 'budgets recorded',
        ok: false,
        detail: 'no budget rows exist, so this gate asserts nothing',
      },
    ];
  }

  for (const key of keys) {
    const { engine, scenario } = splitKey(key);
    const budget = budgets[key];
    const result = results.engines[engine];

    // A budgeted engine that skipped is legitimate locally and never on the gate: the thing being
    // protected did not run, and a green result would claim otherwise.
    if (!result) {
      assertions.push({ label: key, ok: false, detail: `engine "${engine}" did not run` });
      continue;
    }
    if (result.status !== 'measured') {
      assertions.push({
        label: key,
        ok: false,
        detail: `engine "${engine}" ${result.status}: ${result.reason}`,
      });
      continue;
    }
    const scenarioResult = result.scenarios[scenario];
    if (!scenarioResult) {
      assertions.push({ label: key, ok: false, detail: `scenario "${scenario}" did not run` });
      continue;
    }

    if (budget.maxWarmColdRatio !== undefined) {
      checkIncrementality(key, budget.maxWarmColdRatio, scenarioResult.metrics, assertions);
    }
    if (budget.reference) {
      checkReference(key, scenario, budget.reference, results, assertions);
    }
    if (budget.memory) {
      checkMemory(key, budget.memory, scenarioResult.metrics, assertions);
    }
  }

  return assertions;
}
