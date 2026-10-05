import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
      },
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        // Worker thread that runs react-docgen during production builds; exported so the plugin
        // resolves it through the package map (import.meta.resolve) under strict layouts like pnpm.
        exportEntries: ['./internal/react-docgen-worker'],
        entryPoint: './src/plugins/react-docgen-worker.ts',
        dts: false,
      },
    ],
  },
};

export default config;
