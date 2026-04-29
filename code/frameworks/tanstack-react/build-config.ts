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
        exportEntries: ['./start'],
        entryPoint: './src/export-mocks/start.ts',
      },
      {
        exportEntries: ['./react-router'],
        entryPoint: './src/export-mocks/react-router.ts',
        external: ['@tanstack/react-router'],
      },
      {
        exportEntries: ['./start-storage-context'],
        entryPoint: './src/export-mocks/start-storage-context.ts',
      },
      {
        exportEntries: ['./start-server'],
        entryPoint: './src/export-mocks/start-server.ts',
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
    ],
  },
};

export default config;
