// Fresh-process spawns per cold/scan median, and it must stay even: the two sides of a control pair
// alternate which runs first on odd and even repetitions, so an odd N gives one side the first slot
// once more than the other and turns the ordering effect into a directional bias on the ratio.
export const PINNED_N = 6;

// Never comparable with PINNED_N results.
export const QUICK_N = 2;

export const RSS_POLL_INTERVAL_MS = 100;

// Compodoc can hang rather than exit on some inputs, and the orchestrator waits on the child's close
// event, so without a kill a hang stalls the whole suite instead of failing the one engine.
export const COMPODOC_TIMEOUT_MS = 10 * 60 * 1000;

// How much of the project the cold pass documents - the two shapes Storybook actually runs.
// `whole-index` is one batch over every component, what the manifest generator does; `first-story` is
// the one component a request asked for, what the docgen server does.
export type ReactScenarioShape = 'whole-index' | 'first-story';

export interface ReactScenarioConfig {
  shape: ReactScenarioShape;
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
  // Save-series length for the in-process engine; compodoc has no save loop and ignores it.
  saves: number;
}

export interface SuiteProfile {
  n: number;
  comparable: boolean;
  react: ReactScenarioConfig[];
  vue: VueScenarioConfig[];
  angular: AngularScenarioConfig;
}

export const DEFAULT_PROFILE: SuiteProfile = {
  n: PINNED_N,
  comparable: true,
  react: [
    { shape: 'whole-index', components: 300, variants: 4, props: 10, saves: 20 },
    // Same project size; only the cold pass and save target differ, so the rows are comparable.
    { shape: 'first-story', components: 300, variants: 4, props: 10, saves: 10 },
  ],
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
  angular: { components: 100, props: 8, saves: 10 },
};

export const QUICK_PROFILE: SuiteProfile = {
  n: QUICK_N,
  comparable: false,
  react: [
    { shape: 'whole-index', components: 20, variants: 2, props: 4, saves: 4 },
    { shape: 'first-story', components: 20, variants: 2, props: 4, saves: 3 },
  ],
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
      saves: 3,
    },
  ],
  angular: { components: 10, props: 4, saves: 3 },
};
