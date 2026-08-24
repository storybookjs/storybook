/**
 * Turns one suite run into a pass/fail verdict against the recorded budgets.
 *
 * Free of process and filesystem work, so the rules can be tested against hand-built results
 * instead of a full run.
 */
import { PERF_BUDGETS, type PerfBudget, type PerfBudgetKey } from '../docgen-shared/budgets.ts';
import type { EngineId, EngineMetrics, Metric, ScenarioResult, SuiteResults } from './types.ts';

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

function valueOf(metric: Metric): number | undefined {
  return metric.status === 'measured' ? metric.value : undefined;
}

/**
 * Warm over cold, for one engine, from one run: like-for-like by construction, and it rises when
 * re-extraction after a save stops being incremental.
 */
function checkIncrementality(key: string, max: number, metrics: EngineMetrics): Assertion {
  const label = `${key} warm/cold ratio`;
  const cold = valueOf(metrics.coldExtractionMs);
  const warm = valueOf(metrics.warmExtractionMs);

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
      value: valueOf(peakTransientMb),
      max: memory.maxTransientMb,
    },
    {
      metric: 'retained growth (MB)',
      value: valueOf(retainedGrowthMb),
      max: memory.maxRetainedGrowthMb,
    },
    {
      metric: 'retained slope (MB/save)',
      value: valueOf(retainedSlopeMbPerSave),
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
 * The scenario a budget row names, or why there is nothing to assert against. A budgeted engine
 * that skipped is fine locally and never on the gate: the protected thing did not run.
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
 * The gate asserts the budget rows it has, so a scenario nobody wrote a row for would be measured
 * every night and protected by nothing. Adding a scenario therefore fails the gate until its
 * baseline is recorded, which is the point at which the number to budget exists.
 */
function checkEveryScenarioBudgeted(
  results: SuiteResults,
  budgets: Partial<Record<PerfBudgetKey, PerfBudget>>
): Assertion {
  const unbudgeted = Object.entries(results.engines).flatMap(([engine, result]) =>
    result?.status === 'measured'
      ? Object.keys(result.scenarios)
          .filter((scenario) => budgets[`${engine as EngineId}/${scenario}`] === undefined)
          .map((scenario) => `${engine}/${scenario}`)
      : []
  );

  const label = 'every measured scenario has a budget';
  return unbudgeted.length === 0
    ? pass(label)
    : fail(label, `${unbudgeted.join(', ')} measured with no budget row in budgets.ts`);
}

/**
 * Every assertion the gate makes about one run, in print order. The whole-run rules come first
 * because each invalidates everything after it.
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
    checkEveryScenarioBudgeted(results, budgets),
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
