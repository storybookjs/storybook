import { builtinModules } from 'node:module';
import { join } from 'node:path';

import * as esbuild from 'esbuild';
import { pathToFileURL } from 'node:url';

export type EntryType = 'node' | 'browser' | 'runtime' | 'globalizedRuntime';

export type BuildEntry = {
  exportEntries?: ('.' | `./${string}`)[]; // the keys in the package.json's export map, e.g. ["./internal/manager-api", "./manager-api"]
  entryPoint: `./src/${string}`; // the source file to bundle, e.g. "./src/manager-api/index.ts"
  dts?: false; // default to generating d.ts files for all entries, except if set to false
};
export type BuildEntriesByPlatform = Partial<Record<EntryType, BuildEntry[]>>;

export type EsbuildContextOptions = Parameters<(typeof esbuild)['context']>[0];

export type BuildEntries = {
  /**
   * The map of entry points by platform
   *
   * Each platform is optional
   */
  entries: BuildEntriesByPlatform;
  /**
   * The map of extra outputs to be added to the package.json's exports
   *
   * This can be useful to expose non-compiled/non-js files such as Svelte components,
   */
  extraOutputs?: Record<string, any>;
  /**
   * The function to run before the build
   *
   * @note this runs only **once** when watch-mode is enabled
   */
  prebuild?: (cwd: string) => Promise<void>;
  /**
   * The function to run after each successful build (works with watch-mode)
   *
   * @note this runs **after** each successful build, even in watch-mode
   */
  postbuild?: (cwd: string) => Promise<void>;
};

export type BuildEntriesByPackageName = Record<string, BuildEntries>;

export const measure = async (fn: () => Promise<void>) => {
  const start = process.hrtime();
  await fn();
  return process.hrtime(start);
};

export const getExternal = async (cwd: string) => {
  const { default: packageJson } = await import(pathToFileURL(join(cwd, 'package.json')).href, {
    with: { type: 'json' },
  });

  const runtimeExternalInclude: string[] = [
    'react',
    'react-dom',
    'react-dom/client',
    '@storybook/icons',

    /**
     * @note This is not a real package, it's a hack to allow `frameworks/nextjs` to be able to alias
     * whilst also able to use the nextjs version
     *
     * @see `code/frameworks/nextjs/src/images/next-image.tsx`
     */
    'sb-original',
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
