import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./client'],
        entryPoint: './src/client/index.ts',
        dts: false,
      },
      {
        exportEntries: ['./client/config'],
        entryPoint: './src/client/config.ts',
        dts: false,
      },
      {
        exportEntries: ['./client/preview-prod'],
        entryPoint: './src/client/preview-prod.ts',
        dts: false,
      },
      {
        exportEntries: ['./client/docs/config'],
        entryPoint: './src/client/docs/config.ts',
        dts: false,
      },
    ],
    node: [
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        exportEntries: ['./vitest'],
        entryPoint: './src/node/vitest.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./builders/start-storybook'],
        entryPoint: './src/builders/start-storybook/index.ts',
        dts: false,
      },
      {
        exportEntries: ['./builders/build-storybook'],
        entryPoint: './src/builders/build-storybook/index.ts',
        dts: false,
      },
      {
        // Worker-target docgen module imported by core's docgen worker. Exposed as an internal
        // export so the preset resolves it via import.meta.resolve (package map) instead of a
        // hard-coded dist path.
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/docgen/docgen-worker.ts',
        dts: false,
      },
    ],
  },
};

export default config;
