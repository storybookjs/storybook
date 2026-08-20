import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

// Mock modules are resolved/aliased at runtime; skip d.ts emission so the
// type bundler does not walk storybook/test → vitest declaration graphs.
const mockEntries = [
  {
    exportEntries: ['./browser/mocks/cache', './node/mocks/cache'],
    entryPoint: './src/plugins/next-mocks/alias/cache/index.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/navigation', './node/mocks/navigation'],
    entryPoint: './src/plugins/next-mocks/alias/navigation/index.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/headers', './node/mocks/headers'],
    entryPoint: './src/plugins/next-mocks/alias/headers/index.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/router', './node/mocks/router'],
    entryPoint: './src/plugins/next-mocks/alias/router/index.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/link', './node/mocks/link'],
    entryPoint: './src/plugins/next-mocks/alias/link/index.tsx',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/server-only', './node/mocks/server-only'],
    entryPoint: './src/plugins/next-mocks/alias/rsc/server-only.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/dynamic', './node/mocks/dynamic'],
    entryPoint: './src/plugins/next-mocks/alias/dynamic/index.tsx',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/safe-stable-stringify', './node/mocks/safe-stable-stringify'],
    entryPoint: './src/plugins/next-mocks/alias/safe-stable-stringify/index.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/draft-mode.compat', './node/mocks/draft-mode.compat'],
    entryPoint: './src/plugins/next-mocks/compatibility/draft-mode.compat.ts',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/image', './node/mocks/image'],
    entryPoint: './src/plugins/next-image/alias/next-image.tsx',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/legacy-image', './node/mocks/legacy-image'],
    entryPoint: './src/plugins/next-image/alias/next-legacy-image.tsx',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/image-default-loader', './node/mocks/image-default-loader'],
    entryPoint: './src/plugins/next-image/alias/image-default-loader.tsx',
    dts: false as const,
  },
  {
    exportEntries: ['./browser/mocks/image-context', './node/mocks/image-context'],
    entryPoint: './src/plugins/next-image/alias/image-context.tsx',
    dts: false as const,
  },
];

const config: BuildEntries = {
  entries: {
    // Mock modules are loaded by Vite/Vitest via package exports; browser platform
    // matches how @storybook/nextjs-vite ships its own export-mocks.
    browser: [...mockEntries],
    node: [
      {
        exportEntries: ['.'],
        entryPoint: './src/index.ts',
      },
      // Resolved relatively from the compiled plugin for Vitest setupFiles.
      {
        entryPoint: './src/mocks/storybook.global.ts',
        dts: false,
      },
    ],
  },
};

export default config;
