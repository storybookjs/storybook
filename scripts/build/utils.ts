
export type BuildEntry = {
  exportEntries?: `./${string}`[]; // the keys in the package.json's export map, e.g. ["./internal/manager-api", "./manager-api"]
  entryPoint: `./src/${string}`; // the source file to bundle, e.g. "./src/manager-api/index.ts"
  dts?: false; // default to generating d.ts files for all entries, except if set to false
};
export type BuildEntriesByPlatform = Record<
  'node' | 'browser' | 'runtime' | 'globalizedRuntime',
  BuildEntry[]
>;

export type BuildEntriesByPackageName = Record<
  string,
  {
    entries: BuildEntriesByPlatform;
    prebuild?: (cwd: string) => Promise<void>;
    postbuild?: (cwd: string) => Promise<void>;
  }
>;

export const measure = async (fn: () => Promise<void>) => {
  const start = process.hrtime();
  await fn();
  return process.hrtime(start);
};
