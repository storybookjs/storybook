const GLOBAL_INPUTS = [
  /(^|\/)(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.npmrc|nx\.json|\.nvmrc|tsconfig[^/]*\.json|vite(st)?((\.[\w-]+)*\.(config|workspace|shared|setup)|-setup)\.[^/]*)$/,
  /^(patches|code\/__mocks__)\//,
];

/** A change to a global input can affect any test, so it needs the full suite. */
export const isGlobalInput = (file: string) => GLOBAL_INPUTS.some((pattern) => pattern.test(file));

/** Tests read fixtures and snapshots from disk, so `vitest related` cannot trace them to a test. */
export const isTestFixture = (file: string) => /(^|\/)(__[^/]+__|fixtures)\//.test(file);
