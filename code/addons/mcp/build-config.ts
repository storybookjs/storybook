import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
    ],
    browser: [
      {
        // Not exported: the preset references dist/preview.js by path
        entryPoint: './src/preview.ts',
        dts: false,
      },
    ],
    runtime: [
      {
        // Built without code-splitting: preview-stories inlines this file as
        // a self-contained script into an HTML template, so it cannot import
        // shared chunks
        exportEntries: ['./internal/preview-stories-app-script'],
        entryPoint: './src/tools/preview-stories/preview-stories-app-script.ts',
        dts: false,
      },
    ],
  },
};

export default config;
