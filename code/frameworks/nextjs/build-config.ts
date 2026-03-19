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
      {
        exportEntries: ['./compatibility/draft-mode.compat'],
        entryPoint: './src/compatibility/draft-mode.compat.ts',
        dts: false,
      },
      {
        exportEntries: ['./next-image-loader-stub'],
        entryPoint: './src/next-image-loader-stub.ts',
        dts: false,
      },
      {
        exportEntries: ['./image-context'],
        entryPoint: './src/image-context.ts',
        dts: false,
      },
      {
        exportEntries: ['./images/next-image'],
        entryPoint: './src/images/next-image.tsx',
        dts: false,
      },
      {
        exportEntries: ['./images/next-legacy-image'],
        entryPoint: './src/images/next-legacy-image.tsx',
        dts: false,
      },
      {
        exportEntries: ['./rsc/server-only'],
        entryPoint: './src/rsc/server-only.ts',
        dts: false,
      },
    ],
    node: [
      {
        exportEntries: ['./node'],
        entryPoint: './src/node/index.ts',
      },
      {
        exportEntries: ['./preset'],
        entryPoint: './src/preset.ts',
        dts: false,
      },
      {
        exportEntries: ['./export-mocks'],
        entryPoint: './src/export-mocks/index.ts',
        dts: false,
      },
      {
        exportEntries: ['./next-swc-loader-patch'],
        entryPoint: './src/swc/next-swc-loader-patch.ts',
        dts: false,
      },
      {
        exportEntries: ['./storybook-nextjs-font-loader'],
        entryPoint: './src/font/webpack/loader/storybook-nextjs-font-loader.ts',
        dts: false,
      },
    ],
  },
};

export default config;
