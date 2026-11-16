const GLOBAL_INPUTS = [
  /(^|\/)(package\.json|yarn\.lock|\.yarnrc[^/]*|nx\.json|\.nvmrc|tsconfig[^/]*\.json|vite(st)?((\.[\w-]+)*\.(config|workspace|shared|setup)|-setup)\.[^/]*)$/,
  /^(\.yarn\/patches|code\/__mocks__)\//,
];

/** A change to a global input can affect any test, so it needs the full suite. */
export const isGlobalInput = (file: string) => GLOBAL_INPUTS.some((pattern) => pattern.test(file));

/** Tests read fixtures and snapshots from disk, so `vitest related` cannot trace them to a test. */
export const isTestFixture = (file: string) => /(^|\/)(__[^/]+__|fixtures)\//.test(file);
