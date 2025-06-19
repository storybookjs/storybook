import type { BuildOptions } from 'esbuild';

import { defineEntry } from '../../../scripts/prepare/tools';

export type ESMOnlyEntry = {
  exportEntries: `./${string}`[]; // the keys in the package.json's export map, e.g. ["./internal/manager-api", "./manager-api"]
  entryPoint: `./src/${string}`; // the source file to bundle, e.g. "./src/manager-api/index.ts"
  dts?: false; // default to generating d.ts files for all entries, except if set to false
  platform?: BuildOptions['platform']; // unused for now
  isRuntime?: boolean; // used for manager and preview runtimes which needs special esbuild configuration
};

export const esmOnlyEntries: ESMOnlyEntry[] = [
  {
    exportEntries: ['./internal/node-logger'],
    entryPoint: './src/node-logger/index.ts',
  },
  {
    exportEntries: ['./internal/client-logger'],
    entryPoint: './src/client-logger/index.ts',
  },
  {
    exportEntries: ['./internal/preview/runtime'],
    entryPoint: './src/preview/runtime.ts',
    dts: false,
    isRuntime: true,
  },
  {
    exportEntries: ['./internal/manager/globals-runtime'],
    entryPoint: './src/manager/globals-runtime.ts',
    dts: false,
    isRuntime: true,
  },
];

export const getEntries = (cwd: string) => {
  const define = defineEntry(cwd);
  return [
    // empty, right now, TDB what to do with this
    define('src/index.ts', ['node', 'browser'], true),

    define('src/theming/index.ts', ['browser', 'node'], true, ['react'], [], [], true),
    define('src/theming/create.ts', ['browser', 'node'], true, ['react'], [], [], true),

    define('src/core-server/index.ts', ['node'], true, ['react']),
    define('src/core-server/presets/common-preset.ts', ['node'], false),
    define('src/core-server/presets/common-manager.ts', ['browser'], false, [
      'react',
      '@storybook/icons',
    ]),
    define('src/core-server/presets/common-override-preset.ts', ['node'], false),

    define('src/highlight/index.ts', ['browser', 'node'], true, ['react'], [], [], true),

    define('src/actions/index.ts', ['browser', 'node'], true, ['react'], [], [], true),
    define('src/actions/decorator.ts', ['browser'], true, ['react'], [], [], true),

    define('src/viewport/index.ts', ['browser', 'node'], true, ['react'], [], [], true),

    define('src/controls/index.ts', ['browser', 'node'], true, ['react']),
    define('src/controls/decorator.ts', ['browser'], true, ['react']),

    define('src/core-events/index.ts', ['browser', 'node'], true),
    define('src/manager-errors.ts', ['browser'], true),
    define('src/preview-errors.ts', ['browser', 'node'], true),
    define('src/server-errors.ts', ['node'], true),

    define('src/channels/index.ts', ['browser', 'node'], true),
    define('src/types/index.ts', ['browser', 'node'], true, ['react']),
    define('src/csf-tools/index.ts', ['node'], true),
    define('src/csf/index.ts', ['browser', 'node'], true),
    define('src/common/index.ts', ['node'], true),
    define('src/builder-manager/index.ts', ['node'], true),
    define('src/telemetry/index.ts', ['node'], true),
    define('src/preview-api/index.ts', ['browser', 'node'], true, ['react'], [], [], true),
    define(
      'src/manager-api/index.ts',
      ['browser', 'node'],
      true,
      ['react', 'react-dom'],
      [],
      [],
      true
    ),
    define('src/router/index.ts', ['browser', 'node'], true, ['react']),
    define('src/components/index.ts', ['browser', 'node'], true, ['react', 'react-dom'], []),
    define('src/docs-tools/index.ts', ['browser', 'node'], true),

    define('src/manager/globals-module-info.ts', ['node'], true),
    define('src/manager/globals.ts', ['node'], true),
    define('src/preview/globals.ts', ['node'], true),
    define('src/cli/index.ts', ['node'], true),
    define('src/babel/index.ts', ['node'], true),
    define('src/cli/bin/index.ts', ['node'], true),
    define('src/bin/index.ts', ['node'], false),

    define('src/instrumenter/index.ts', ['browser', 'node'], true),
    define(
      'src/test/index.ts',
      ['browser', 'node'],
      true,
      ['util', 'react'],
      [],
      [
        '@testing-library/jest-dom',
        '@testing-library/user-event',
        'chai',
        '@vitest/expect',
        '@vitest/spy',
        '@vitest/utils',
      ],
      true
    ),
  ];
};

// the runtime for the manager
export const getFinals = (cwd: string) => {
  const define = defineEntry(cwd);

  return [
    //
    define('src/manager/runtime.tsx', ['browser'], false),
  ];
};
