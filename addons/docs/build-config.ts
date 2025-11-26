import type { BuildEntries } from '../../scripts/build/utils/entry-utils';

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
      },
      {
        exportEntries: ['./manager'],
        entryPoint: './src/manager.tsx',
        dts: false,
      },
      {
        exportEntries: ['./blocks'],
        entryPoint: './src/blocks.ts',
      },
      {
        exportEntries: ['./mdx-react-shim'],
        entryPoint: './src/mdx-react-shim.ts',
      },
      {
        exportEntries: ['./ember'],
        entryPoint: './src/ember/index.ts',
      },
      {
        exportEntries: ['./angular'],
        entryPoint: './src/angular/index.ts',
      },
      {
        exportEntries: ['./web-components'],
        entryPoint: './src/web-components/index.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./mdx-loader'],
        entryPoint: './src/mdx-loader.ts',
        dts: false,
      },
    ],
  },
};

export default config;
