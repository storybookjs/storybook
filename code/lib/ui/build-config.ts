import type { BuildEntries } from '../../../scripts/build/utils/entry-utils.ts';

const config: BuildEntries = {
  entries: {
    browser: [
      {
        exportEntries: ['./theming'],
        entryPoint: './src/theming/index.ts',
      },
      {
        exportEntries: ['./theming/create'],
        entryPoint: './src/theming/create.ts',
      },
      {
        exportEntries: ['./internal/components'],
        entryPoint: './src/components/index.ts',
      },
      {
        exportEntries: ['./internal/tour-guide'],
        entryPoint: './src/tour-guide/index.ts',
      },
      // Deep entries: files the higher packages import directly.
      {
        exportEntries: ['./internal/deep/components/components/icon/icon'],
        entryPoint: './src/components/components/icon/icon.tsx',
      },
      {
        exportEntries: ['./internal/deep/components/components/tooltip/TooltipLinkList'],
        entryPoint: './src/components/components/tooltip/TooltipLinkList.tsx',
      },
      {
        exportEntries: ['./internal/deep/components/components/utils/platform'],
        entryPoint: './src/components/components/utils/platform.ts',
      },
      {
        exportEntries: ['./internal/deep/components/components/utils/shortcut'],
        entryPoint: './src/components/components/utils/shortcut.ts',
      },
      {
        exportEntries: ['./internal/deep/components/components/utils/useMedia'],
        entryPoint: './src/components/components/utils/useMedia.tsx',
      },
      {
        exportEntries: ['./internal/deep/components/focus-scope'],
        entryPoint: './src/components/focus-scope.ts',
      },
      {
        exportEntries: ['./internal/deep/theming/polished'],
        entryPoint: './src/theming/polished.ts',
      },
    ],
  },
};

export default config;
