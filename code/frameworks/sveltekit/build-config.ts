import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      {
        exportEntries: ['./preview'],
        entryPoint: './src/preview.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/mocks/app/forms'],
        entryPoint: './src/mocks/app/forms.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/mocks/app/navigation'],
        entryPoint: './src/mocks/app/navigation.ts',
        dts: false,
      },
      {
        exportEntries: ['./internal/mocks/app/stores'],
        entryPoint: './src/mocks/app/stores.ts',
        dts: false,
      },
    ],
    node: [
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        exportEntries: ['./vite-plugin'],
        entryPoint: './src/vite-plugin.ts',
        dts: false,
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
    ],
  },
  extraOutputs: {
    './internal/mocks/app/state.svelte.js': './static/app-state-mock.svelte.js',
    './internal/MockProvider.svelte': './static/MockProvider.svelte',
  },
};

export default config;
