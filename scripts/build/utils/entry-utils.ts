import { builtinModules } from 'node:module';
import { join } from 'node:path';

import * as esbuild from 'esbuild';

export type BuildEntry = {
  exportEntries?: ('.' | `./${string}`)[]; // the keys in the package.json's export map, e.g. ["./internal/manager-api", "./manager-api"]
  entryPoint: `./src/${string}`; // the source file to bundle, e.g. "./src/manager-api/index.ts"
  dts?: false; // default to generating d.ts files for all entries, except if set to false
};
export type BuildEntriesByPlatform = Partial<
  Record<'node' | 'browser' | 'runtime' | 'globalizedRuntime', BuildEntry[]>
>;

export type EsbuildContextOptions = Parameters<(typeof esbuild)['context']>[0];

export type BuildEntries = {
  entries: BuildEntriesByPlatform;
  prebuild?: (cwd: string) => Promise<void>;
  postbuild?: (cwd: string) => Promise<void>;
};

export type BuildEntriesByPackageName = Record<string, BuildEntries>;

export const measure = async (fn: () => Promise<void>) => {
  const start = process.hrtime();
  await fn();
  return process.hrtime(start);
};

export const getExternal = async (cwd: string) => {
  const { default: packageJson } = await import(join(cwd, 'package.json'), {
    with: { type: 'json' },
  });

  const runtimeExternalInclude: string[] = [
    'react',
    'react-dom',
    'react-dom/client',
    packageJson.name,
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ];
  const runtimeExternalExclude = [
    '@testing-library/jest-dom',
    '@testing-library/user-event',
    'chai',
    '@vitest/expect',
    '@vitest/spy',
    '@vitest/utils',
  ];
  const runtimeExternal = runtimeExternalInclude.filter(
    (dep) => !runtimeExternalExclude.includes(dep)
  );
  const typesExternal = [
    ...runtimeExternalInclude,
    'ast-types',
    ...builtinModules.flatMap((m: string) => [m, `node:${m}`]),
  ];

  return { runtimeExternal, typesExternal };
};
