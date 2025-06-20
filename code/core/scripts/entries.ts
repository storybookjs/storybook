import { defineEntry } from '../../../scripts/prepare/tools';

export type ESMOnlyEntry = {
  exportEntries?: `./${string}`[]; // the keys in the package.json's export map, e.g. ["./internal/manager-api", "./manager-api"]
  entryPoint: `./src/${string}`; // the source file to bundle, e.g. "./src/manager-api/index.ts"
  dts?: false; // default to generating d.ts files for all entries, except if set to false
};
export type ESMOnlyEntriesByPlatform = Record<
  'node' | 'browser' | 'runtime' | 'globalizedRuntime',
  ESMOnlyEntry[]
>;

export const esmOnlyEntries: ESMOnlyEntriesByPlatform = {
  node: [
    {
      exportEntries: ['./internal/node-logger'],
      entryPoint: './src/node-logger/index.ts',
    },
    {
      exportEntries: ['./internal/server-errors'],
      entryPoint: './src/server-errors.ts',
    },
    {
      exportEntries: ['./internal/core-server'],
      entryPoint: './src/core-server/index.ts',
    },
    {
      entryPoint: './src/core-server/presets/common-preset.ts',
      dts: false,
    },
    {
      entryPoint: './src/core-server/presets/common-override-preset.ts',
      dts: false,
    },
    {
      exportEntries: ['./internal/telemetry'],
      entryPoint: './src/telemetry/index.ts',
    },
    {
      exportEntries: ['./internal/csf-tools'],
      entryPoint: './src/csf-tools/index.ts',
    },
    {
      exportEntries: ['./internal/babel'],
      entryPoint: './src/babel/index.ts',
    },
  ],
  browser: [
    {
      exportEntries: ['./internal/client-logger'],
      entryPoint: './src/client-logger/index.ts',
    },

    {
      exportEntries: ['./internal/instrumenter'],
      entryPoint: './src/instrumenter/index.ts',
    },
    {
      exportEntries: ['./test', './internal/test'],
      entryPoint: './src/test/index.ts',
    },
    {
      exportEntries: ['./preview-api', './internal/preview-api'],
      entryPoint: './src/preview-api/index.ts',
    },
    {
      exportEntries: ['./highlight', './internal/highlight'],
      entryPoint: './src/highlight/index.ts',
    },
    {
      exportEntries: ['./actions', './internal/actions'],
      entryPoint: './src/actions/index.ts',
    },
    {
      exportEntries: ['./actions/decorator', './internal/actions/decorator'],
      entryPoint: './src/actions/decorator.ts',
    },
    {
      exportEntries: ['./viewport', './internal/viewport'],
      entryPoint: './src/viewport/index.ts',
    },
    {
      exportEntries: ['./internal/preview/globals'],
      entryPoint: './src/preview/globals.ts',
    },
    {
      exportEntries: ['./internal/csf'],
      entryPoint: './src/csf/index.ts',
    },
    {
      exportEntries: ['./internal/manager-errors'],
      entryPoint: './src/manager-errors.ts',
    },
    {
      exportEntries: ['./internal/preview-errors'],
      entryPoint: './src/preview-errors.ts',
    },
    {
      exportEntries: ['./internal/manager/globals'],
      entryPoint: './src/manager/globals.ts',
    },
    {
      entryPoint: './src/core-server/presets/common-manager.ts',
      dts: false,
    },
    {
      exportEntries: ['./theming', './internal/theming'],
      entryPoint: './src/theming/index.ts',
    },
    {
      exportEntries: ['./theming/create', './internal/theming/create'],
      entryPoint: './src/theming/create.ts',
    },
    {
      exportEntries: ['./internal/components'],
      entryPoint: './src/components/index.ts',
    },
    {
      exportEntries: ['./manager-api', './internal/manager-api'],
      entryPoint: './src/manager-api/index.ts',
    },
    {
      exportEntries: ['./internal/router'],
      entryPoint: './src/router/index.ts',
    },
    {
      exportEntries: ['./internal/docs-tools'],
      entryPoint: './src/docs-tools/index.ts',
    },
  ],
  runtime: [
    {
      exportEntries: ['./internal/preview/runtime'],
      entryPoint: './src/preview/runtime.ts',
      dts: false,
    },
    {
      exportEntries: ['./internal/manager/globals-runtime'],
      entryPoint: './src/manager/globals-runtime.ts',
      dts: false,
    },
  ],
  globalizedRuntime: [
    {
      entryPoint: './src/manager/runtime.tsx',
      dts: false,
    },
  ],
};

export const esmOnlyDtsEntries: ESMOnlyEntry[] = Object.values(esmOnlyEntries)
  .flat()
  .filter((entry) => entry.dts !== false);

export const getEntries = (cwd: string) => {
  const define = defineEntry(cwd);
  return [
    // empty, right now, TDB what to do with this
    define('src/index.ts', ['node', 'browser'], true),

    define('src/core-events/index.ts', ['browser', 'node'], true),

    define('src/channels/index.ts', ['browser', 'node'], true),
    define('src/types/index.ts', ['browser', 'node'], true, ['react']),
    define('src/common/index.ts', ['node'], true),
    define('src/builder-manager/index.ts', ['node'], true),

    define('src/cli/index.ts', ['node'], true),
    define('src/cli/bin/index.ts', ['node'], true),
    define('src/bin/index.ts', ['node'], false),
  ];
};
