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
        exportEntries: ['./config/preview'],
        entryPoint: './src/config/preview.ts',
        dts: false,
      },
      {
        exportEntries: ['./cache.mock'],
        entryPoint: './src/export-mocks/cache/index.ts',
      },
      {
        exportEntries: ['./headers.mock'],
        entryPoint: './src/export-mocks/headers/index.ts',
      },
      {
        exportEntries: ['./image-context'],
        entryPoint: './src/image-context.ts',
      },
      {
        exportEntries: ['./navigation.mock'],
        entryPoint: './src/export-mocks/navigation/index.ts',
      },
      {
        exportEntries: ['./link.mock'],
        entryPoint: './src/export-mocks/link/index.tsx',
      },
      {
        exportEntries: ['./router.mock'],
        entryPoint: './src/export-mocks/router/index.ts',
      },
    ],
    node: [
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        exportEntries: ['./vite-plugin'],
        entryPoint: './src/vite-plugin/index.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
    ],
  },
};

export default config;
