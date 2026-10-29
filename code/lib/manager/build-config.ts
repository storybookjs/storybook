import path from 'node:path';

import { x as exec } from 'tinyexec';

import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  prebuild: async (cwd) => {
    await exec('jiti', [path.join(import.meta.dirname, 'scripts', 'generate-source-files.ts')], {
      nodeOptions: {
        cwd,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          FORCE_COLOR: '1',
        },
        stdio: 'inherit',
      },
      throwOnError: true,
    });
  },
  entries: {
    node: [
      // Deep entries: files the product imports directly.
      {
        exportEntries: ['./internal/deep/builder-manager'],
        entryPoint: './src/builder-manager/index.ts',
      },
      {
        exportEntries: ['./internal/deep/builder-manager/hooks'],
        entryPoint: './src/builder-manager/hooks.ts',
      },
      {
        exportEntries: ['./internal/deep/builder-manager/host'],
        entryPoint: './src/builder-manager/host.ts',
      },
    ],
    browser: [
      {
        exportEntries: ['./internal/manager/globals'],
        entryPoint: './src/ui/globals.ts',
      },
      {
        exportEntries: ['./internal/manager/manager-stores'],
        entryPoint: './src/ui/manager-stores.ts',
      },
      {
        exportEntries: ['./manager-api'],
        entryPoint: './src/manager-api/index.ts',
      },
      {
        exportEntries: ['./internal/router'],
        entryPoint: './src/router/index.ts',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/docgen/manager'],
        entryPoint: './src/shared/open-service/services/docgen/manager.tsx',
      },
      {
        exportEntries: ['./internal/deep/shared/open-service/services/review/manager'],
        entryPoint: './src/shared/open-service/services/review/manager.tsx',
      },
      {
        exportEntries: ['./internal/deep/shared/viewport/useViewport'],
        entryPoint: './src/shared/viewport/useViewport.ts',
      },
      {
        exportEntries: ['./internal/deep/ui/utils/trySelectStory'],
        entryPoint: './src/ui/utils/trySelectStory.ts',
      },
    ],
    runtime: [
      {
        exportEntries: ['./internal/manager/globals-runtime'],
        entryPoint: './src/ui/globals-runtime.ts',
        dts: false,
        chunkedRuntime: true,
      },
    ],
    globalizedRuntime: [
      {
        entryPoint: './src/ui/runtime.tsx',
        dts: false,
      },
    ],
  },
};

export default config;
