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
      },
      {
        exportEntries: ['./entry-preview'],
        entryPoint: './src/entry-preview.tsx',
        dts: false,
        // The module of the project that the preset makes
        external: ['virtual:@storybook/nextjs-vite-rsc/project'],
      },
      // The plugin loads these in the browser layer by their path: each one stays a file of its
      // own, which the other entries import by the package's name, not a chunk of the bundle.
      {
        exportEntries: ['./internal/client-story'],
        entryPoint: './src/client-story.tsx',
      },
      {
        exportEntries: ['./internal/addon-docs'],
        entryPoint: './src/docs/addon-docs.ts',
      },
      {
        exportEntries: ['./internal/docs-renderer'],
        entryPoint: './src/docs/docs-renderer.tsx',
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
      },
    ],
  },
};

export default config;
