/**
 * Fixed measurement parameters for the per-engine docgen performance suite.
 *
 * N is pinned here for every engine and recorded with the results; numbers taken at different N are
 * not comparable. The --quick profile exists for smoke runs only and marks its results
 * non-comparable.
 */

/**
 * Fresh-process spawns per cold/scan median. One value for all engines.
 *
 * Must stay even. The two sides of a control pair alternate which one runs first on odd and even
 * repetitions, so an odd N gives one side the first slot once more than the other, and the cold
 * figure - a median - then lands on a repetition from the majority slot. That turns the ordering
 * effect the alternation exists to cancel into a systematic, directional bias on the headline ratio.
 */
export const PINNED_N = 6;

/** Spawns for --quick smoke runs. Never comparable with PINNED_N results. */
export const QUICK_N = 2;

/** Sampling interval for the compodoc child's externally-polled peak RSS. */
export const RSS_POLL_INTERVAL_MS = 100;

/**
 * How long one compodoc run may take before it is killed. Compodoc can hang rather than exit on
 * some inputs, and the orchestrator waits on the child's close event, so a hang without this would
 * stall the whole suite indefinitely instead of failing the one engine.
 */
export const COMPODOC_TIMEOUT_MS = 10 * 60 * 1000;

export interface AngularScenarioConfig {
  components: number;
  props: number;
}

export interface SuiteProfile {
  n: number;
  comparable: boolean;
  angular: AngularScenarioConfig;
}

export const DEFAULT_PROFILE: SuiteProfile = {
  n: PINNED_N,
  comparable: true,
  angular: { components: 100, props: 8 },
};

export const QUICK_PROFILE: SuiteProfile = {
  n: QUICK_N,
  comparable: false,
  angular: { components: 10, props: 4 },
};
