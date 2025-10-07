import type { BuildEntries } from '../../../scripts/build/utils/entry-utils';

const config: BuildEntries = {
  extraOutputs: {
    './navigation': {
      types: './dist/rsc/navigation.react-server.d.ts',
      'react-server': './dist/rsc/navigation.react-server.js',
      default: './dist/rsc/navigation.js',
    },
  },
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
        exportEntries: ['./cache.mock'],
        entryPoint: './src/export-mocks/cache/index.ts',
      },
      {
        exportEntries: ['./headers.mock'],
        entryPoint: './src/export-mocks/headers/index.ts',
      },
      {
        exportEntries: ['./navigation.mock'],
        entryPoint: './src/export-mocks/navigation/index.ts',
      },
      {
        exportEntries: ['./router.mock'],
        entryPoint: './src/export-mocks/router/index.ts',
      },
      {
        exportEntries: ['./load-client-dev'],
        entryPoint: './src/load-client-dev.tsx',
      },
      {
        exportEntries: ['./react-client'],
        entryPoint: './src/react-client.tsx',
      },
      {
        exportEntries: ['./headers'],
        entryPoint: './src/rsc/headers.ts',
      },
      {
        entryPoint: './src/rsc/navigation.ts',
      },
      {
        entryPoint: './src/rsc/navigation.react-server.ts',
      },
      {
        exportEntries: ['./rsc/client'],
        entryPoint: './src/rsc/client.tsx',
      },
      {
        exportEntries: ['./repro'],
        entryPoint: './src/repro.tsx',
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
