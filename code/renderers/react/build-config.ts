import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./preview'],
        entryPoint: './src/preview.tsx',
      },
      {
        exportEntries: ['./entry-preview'],
        entryPoint: './src/entry-preview.tsx',
        dts: false,
      },
      {
        exportEntries: ['./entry-preview-argtypes'],
        entryPoint: './src/entry-preview-argtypes.ts',
        dts: false,
      },
      {
        exportEntries: ['./entry-preview-docs'],
        entryPoint: './src/entry-preview-docs.ts',
        dts: false,
      },
      {
        exportEntries: ['./entry-preview-rsc'],
        entryPoint: './src/entry-preview-rsc.tsx',
        dts: false,
      },
      {
        exportEntries: ['./experimental-playwright'],
        entryPoint: './src/playwright.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
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
