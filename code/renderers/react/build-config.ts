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
    ],
    node: [
      // `./preset` is a deprecated alias that third-party framework presets still resolve.
      { exportEntries: ['./node', './preset'], entryPoint: './src/node.ts' },
      {
        // Core's docgen worker imports this; an internal export lets the renderer resolve it by name.
        exportEntries: ['./internal/docgen-worker'],
        entryPoint: './src/docgen/docgen-worker.ts',
        dts: false,
      },
    ],
  },
};

export default config;
