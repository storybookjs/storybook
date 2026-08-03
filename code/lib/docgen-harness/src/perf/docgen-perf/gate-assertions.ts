/**
 * Turns one suite run into a pass/fail verdict against the recorded budgets.
 *
 * Kept free of process and filesystem work so the rules below - which are the whole point of the
 * gate - can be tested against hand-built results instead of a full run.
 */
import { PERF_BUDGETS, type PerfBudget, type PerfBudgetKey } from '../docgen-shared/budgets.ts';
import type { EngineId, EngineMetrics, ScenarioResult, SuiteResults } from './types.ts';

export interface Assertion {
  label: string;
  ok: boolean;
  /** Why it failed. Absent on a pass. */
  detail?: string;
}

function pass(label: string): Assertion {
  return { label, ok: true };
}

function fail(label: string, detail: string): Assertion {
  return { label, ok: false, detail };
}

function within(label: string, value: number, max: number): Assertion {
  return value <= max
    ? pass(label)
    : fail(label, `${value.toFixed(2)} exceeds the budget of ${max}`);
}

function splitKey(key: PerfBudgetKey): { engine: EngineId; scenario: string } {
  const separator = key.indexOf('/');
  return {
    engine: key.slice(0, separator) as EngineId,
    scenario: key.slice(separator + 1),
  };
}

function median(metric: EngineMetrics[keyof EngineMetrics]): number | undefined {
  return metric.status === 'measured' && 'median' in metric ? metric.median : undefined;
}

/**
 * Warm over cold, for one engine, from one run.
 *
 * Both figures come from the same process over the same project, which makes this like-for-like by
 * construction - no member-count comparison needed - and it rises exactly when re-extraction after
 * a save stops being incremental and starts redoing the cold pass's work.
 */
function checkIncrementality(key: string, max: number, metrics: EngineMetrics): Assertion {
  const label = `${key} warm/cold ratio`;
  const cold = median(metrics.coldExtractionMs);
  const warm = median(metrics.warmExtractionMs);

  if (cold === undefined || warm === undefined || cold === 0) {
    return fail(label, 'cold and warm were not both measured');
  }
  const ratio = warm / cold;
  return ratio <= max
    ? pass(label)
    : fail(
        label,
        `${ratio.toFixed(3)} exceeds the budget of ${max}; re-extraction after a save is no longer incremental`
      );
}

function checkMemory(
  key: string,
  memory: NonNullable<PerfBudget['memory']>,
  metrics: EngineMetrics
): Assertion[] {
  const { peakTransientMb, retainedGrowthMb, retainedSlopeMbPerSave } = metrics;
  const checks = [
    {
      metric: 'peak transient (MB)',
      value: peakTransientMb.status === 'measured' ? peakTransientMb.mean : undefined,
      max: memory.maxTransientMb,
    },
    {
      metric: 'retained growth (MB)',
      value: retainedGrowthMb.status === 'measured' ? retainedGrowthMb.value : undefined,
      max: memory.maxRetainedGrowthMb,
    },
    {
      metric: 'retained slope (MB/save)',
      value:
        retainedSlopeMbPerSave.status === 'measured' ? retainedSlopeMbPerSave.value : undefined,
      max: memory.maxRetainedSlopeMb,
    },
  ];

  return checks.flatMap(({ metric, value, max }) => {
    if (max === undefined) {
      return [];
    }
    const label = `${key} ${metric}`;
    // A budgeted metric reported n/a means the run did not produce the thing being gated on.
    return [
      value === undefined ? fail(label, 'not measured in this run') : within(label, value, max),
    ];
  });
}

/**
 * The scenario a budget row names, or the reason there is nothing to assert it against.
 *
 * A budgeted engine that skipped is legitimate on a laptop missing an optional tool and never on
 * the gate: the thing being protected did not run, and a green result would claim otherwise.
 */
function resolveScenario(
  key: PerfBudgetKey,
  results: SuiteResults
): ScenarioResult | { missing: string } {
  const { engine, scenario } = splitKey(key);
  const result = results.engines[engine];

  if (!result) {
    return { missing: `engine "${engine}" did not run` };
  }
  if (result.status !== 'measured') {
    return { missing: `engine "${engine}" ${result.status}: ${result.reason}` };
  }
  return result.scenarios[scenario] ?? { missing: `scenario "${scenario}" did not run` };
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
  budgets: Partial<Record<PerfBudgetKey, PerfBudget>> = PERF_BUDGETS
): Assertion[] {
  if (!results.comparable) {
    return [
      fail(
        'run is comparable',
        'these are non-comparable smoke numbers; the gate needs a full-profile run'
      ),
    ];
  }

  const entries = Object.entries(budgets) as Array<[PerfBudgetKey, PerfBudget]>;
  if (entries.length === 0) {
    return [
      pass('run is comparable'),
      fail('budgets recorded', 'no budget rows exist, so this gate asserts nothing'),
    ];
  }

  return [
    pass('run is comparable'),
    ...entries.flatMap(([key, budget]) => {
      const scenario = resolveScenario(key, results);
      if ('missing' in scenario) {
        return [fail(key, scenario.missing)];
      }
      return [
        ...(budget.maxWarmColdRatio === undefined
          ? []
          : [checkIncrementality(key, budget.maxWarmColdRatio, scenario.metrics)]),
        ...(budget.memory ? checkMemory(key, budget.memory, scenario.metrics) : []),
      ];
    }),
  ];
}
