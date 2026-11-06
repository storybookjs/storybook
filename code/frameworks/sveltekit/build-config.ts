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
        entryPoint: './src/preview.ts',
        dts: false,
      },
      {
        exportEntries: ['./forms.mock'],
        entryPoint: './src/mocks/app/forms.ts',
      },
      {
        exportEntries: ['./internal/mocks/docs-isolation'],
        entryPoint: './src/mocks/docs-isolation.ts',
      },
      {
        exportEntries: ['./navigation.mock'],
        entryPoint: './src/mocks/app/navigation.ts',
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
  },
};

export default config;
