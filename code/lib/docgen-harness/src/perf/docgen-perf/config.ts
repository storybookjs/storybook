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

export interface ReactScenarioConfig {
  components: number;
  variants: number;
  props: number;
  saves: number;
}

export interface VueScenarioConfig {
  name: 'flat' | 'workspace' | 'base-type-touch';
  packages: number;
  componentsPerPackage: number;
  chainDepth: number;
  fanOut: number;
  heavyLib: boolean;
  saves: number;
}

export interface AngularScenarioConfig {
  components: number;
  props: number;
}

export interface SuiteProfile {
  n: number;
  comparable: boolean;
  react: ReactScenarioConfig;
  vue: VueScenarioConfig[];
  angular: AngularScenarioConfig;
}

export const DEFAULT_PROFILE: SuiteProfile = {
  n: PINNED_N,
  comparable: true,
  react: { components: 300, variants: 4, props: 10, saves: 20 },
  vue: [
    {
      name: 'flat',
      packages: 1,
      componentsPerPackage: 20,
      chainDepth: 1,
      fanOut: 4,
      heavyLib: false,
      saves: 15,
    },
    {
      name: 'workspace',
      packages: 4,
      componentsPerPackage: 10,
      chainDepth: 3,
      fanOut: 4,
      heavyLib: true,
      saves: 15,
    },
    {
      name: 'base-type-touch',
      packages: 4,
      componentsPerPackage: 10,
      chainDepth: 3,
      fanOut: 4,
      heavyLib: true,
      saves: 10,
    },
  ],
  angular: { components: 100, props: 8 },
};

export const QUICK_PROFILE: SuiteProfile = {
  n: QUICK_N,
  comparable: false,
  react: { components: 20, variants: 2, props: 4, saves: 4 },
  vue: [
    {
      name: 'flat',
      packages: 1,
      componentsPerPackage: 5,
      chainDepth: 1,
      fanOut: 2,
      heavyLib: false,
      saves: 3,
    },
    {
      name: 'workspace',
      packages: 2,
      componentsPerPackage: 3,
      chainDepth: 2,
      fanOut: 2,
      heavyLib: true,
      saves: 3,
    },
    {
      name: 'base-type-touch',
      packages: 2,
      componentsPerPackage: 3,
      chainDepth: 2,
      fanOut: 2,
      heavyLib: true,
      saves: 2,
    },
  ],
  angular: { components: 10, props: 4 },
};
