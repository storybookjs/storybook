/**
 * Fixed measurement parameters for the per-engine docgen performance suite.
 *
 * The main suite is descriptive. Its fixed profiles control runtime, while an opt-in paired gate
 * validates and records its own repetition count.
 */

/** Fresh-process repetitions in a full descriptive run. */
export const DEFAULT_REPETITIONS = 6;

/** Fresh-process repetitions for --quick smoke runs. */
export const QUICK_REPETITIONS = 2;

/** Minimum block count for an opt-in paired timing gate. */
export const MIN_PAIRED_REPETITIONS = 10;

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
  repetitions: number;
  react: ReactScenarioConfig;
  vue: VueScenarioConfig[];
  angular: AngularScenarioConfig;
}

export const DEFAULT_PROFILE: SuiteProfile = {
  repetitions: DEFAULT_REPETITIONS,
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
  repetitions: QUICK_REPETITIONS,
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
