import { chmod } from 'node:fs/promises';
import { join } from 'node:path';

import type { BuildEntriesByPackageName } from '../utils';
import { generateSourceFiles } from './storybook/generate-source-files';

export const buildEntries: BuildEntriesByPackageName = {
  storybook: {
    prebuild: generateSourceFiles,
    postbuild: async (cwd) => {
      const dispatcherPath = join(cwd, 'dist', 'bin', 'dispatcher.js');
      await chmod(dispatcherPath, 0o755);
    },
    entries: {
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
          exportEntries: ['./internal/core-server/presets/common-override-preset'],
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
        {
          entryPoint: './src/builder-manager/index.ts',
        },
        {
          exportEntries: ['./internal/bin/dispatcher'],
          entryPoint: './src/bin/dispatcher.ts',
          dts: false,
        },
        {
          entryPoint: './src/bin/core.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/bin/loader'],
          entryPoint: './src/bin/loader.ts',
          dts: false,
        },
        {
          exportEntries: ['./internal/common'],
          entryPoint: './src/common/index.ts',
        },
        {
          entryPoint: './src/cli/index.ts',
          exportEntries: ['./internal/cli'],
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
        {
          exportEntries: ['./internal/core-events'],
          entryPoint: './src/core-events/index.ts',
        },
        {
          exportEntries: ['./internal/channels'],
          entryPoint: './src/channels/index.ts',
        },
        {
          exportEntries: ['./internal/types'],
          entryPoint: './src/types/index.ts',
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
    },
  },
  'create-storybook': {
    entries: {
      node: [
        {
          exportEntries: ['.'],
          entryPoint: './src/index.ts',
        },
        {
          entryPoint: './src/bin/index.ts',
          dts: false,
        },
      ],
    },
  },
};
