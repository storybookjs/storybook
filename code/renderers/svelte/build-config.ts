import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

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
    ],
  },
  extraOutputs: {
    './internal/PreviewRender.svelte': './static/PreviewRender.svelte',
    './internal/DecoratorHandler.svelte': './static/DecoratorHandler.svelte',
    './internal/AddStorybookIdDecorator.svelte': './static/AddStorybookIdDecorator.svelte',
    './internal/createReactiveProps': './static/createReactiveProps.svelte.js',
  },
};

export default config;
