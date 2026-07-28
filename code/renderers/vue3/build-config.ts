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
        // argTypes conversion, shared with the framework's server-side docgen provider. Built for
        // node so the docgen worker can import it; the preview gets it through `entry-preview`.
        exportEntries: ['./internal/extract-arg-types'],
        entryPoint: './src/extractArgTypes.ts',
      },
    ],
  },
};

export default config;
