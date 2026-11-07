const GLOBAL_INPUTS = [
  /(^|\/)(package\.json|yarn\.lock|\.yarnrc[^/]*|nx\.json|\.nvmrc|tsconfig[^/]*\.json|vite(st)?((\.[\w-]+)*\.(config|workspace|shared|setup)|-setup)\.[^/]*)$/,
  /^(\.yarn\/patches|code\/__mocks__)\//,
];

/** A change to a global input can affect any test, so it needs the full suite. */
export const isGlobalInput = (file: string) => GLOBAL_INPUTS.some((pattern) => pattern.test(file));

/** Tests read fixtures and snapshots from disk, so `vitest related` cannot trace them to a test. */
export const isTestFixture = (file: string) => /(^|\/)(__[^/]+__|fixtures)\//.test(file);

/** The tests of `scripts/ci` read the CI config from disk, which `vitest related` cannot trace. */
export const isCiConfig = (file: string) =>
  /^(\.circleci|\.nx|\.github\/workflows)\/|(^|\/)project\.json$/.test(file);

/** A change that `vitest related` cannot trace to the tests it affects, so it needs the full suite. */
export const needsAllUnitTests = (file: string) =>
  isGlobalInput(file) || isTestFixture(file) || isCiConfig(file);
