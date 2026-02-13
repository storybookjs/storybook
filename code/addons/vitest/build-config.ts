import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./manager'],
        entryPoint: './src/manager.tsx',
        dts: false,
      },
      {
        exportEntries: ['./preview'],
        entryPoint: './src/preview.ts',
      },
      {
        exportEntries: ['./internal/setup-file'],
        entryPoint: './src/vitest-plugin/setup-file.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/test-utils'],
        entryPoint: './src/vitest-plugin/test-utils.ts',
        dts: false,
      },
    ],
    node: [
      {
        exportEntries: ['./constants'],
        entryPoint: './src/constants.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/global-setup'],
        entryPoint: './src/vitest-plugin/global-setup.ts',
        dts: false,
      },
      {
        exportEntries: ['./vitest'],
        entryPoint: './src/node/vitest.ts',
        dts: false,
      },
      {
        exportEntries: ['./postinstall'],
        entryPoint: './src/postinstall.ts',
        dts: false,
      },
      {
        exportEntries: ['./vitest-plugin'],
        entryPoint: './src/vitest-plugin/index.ts',
      },
      {
        exportEntries: ['./internal/coverage-reporter'],
        entryPoint: './src/node/coverage-reporter.ts',
        dts: false,
      },
    ],
  },
};

export default config;
