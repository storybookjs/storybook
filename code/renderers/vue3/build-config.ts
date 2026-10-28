import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./entry-preview'],
        entryPoint: './src/entry-preview.ts',
        dts: false,
      },
      {
        exportEntries: ['./entry-preview-docs'],
        entryPoint: './src/entry-preview-docs.ts',
        dts: false,
      },
    ],
    node: [
      {
        // `./preset` is a deprecated alias that third-party framework presets still resolve.
        exportEntries: ['./node', './preset'],
        entryPoint: './src/node.ts',
      },
      {
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/docgen/docgen-worker.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/docgen'],
        entryPoint: './src/docgen/index.ts',
      },
    ],
  },
};

export default config;
