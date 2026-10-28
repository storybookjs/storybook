import '@storybook/builder-vite/node';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineAddon } from 'storybook/internal/instance';

import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';

import { BROWSER_TARGETS } from '../core/src/constants/environments-support.ts';

const currentDirPath = dirname(fileURLToPath(import.meta.url));

const COMPONENTS_PATH = join(currentDirPath, '../lib/ui/src/components/index.ts');
const MANAGER_API_PATH = join(currentDirPath, '../lib/manager/src/manager-api/index.mock.ts');
const PREVIEW_API_PATH = join(currentDirPath, '../core/src/preview-api/index.ts');
const THEMING_CREATE_PATH = join(currentDirPath, '../lib/ui/src/theming/create.ts');
const THEMING_PATH = join(currentDirPath, '../lib/ui/src/theming/index.ts');
const IMAGE_CONTEXT_PATH = join(currentDirPath, '../frameworks/nextjs/src/image-context.ts');

/** Resolve the internal Storybook's own packages to source and tune the preview's Vite config. */
export const internalVite = defineAddon(() => ({
  meta: { name: 'storybook-internal-vite' },
  setup(storybook): void {
    storybook.hook('builder:vite:extend', async (viteConfig, ctx): Promise<InlineConfig> => {
      const { mergeConfig } = await import('vite');
      const isDevelopment = ctx?.configType
        ? ctx.configType === 'DEVELOPMENT'
        : storybook.mode !== 'build';

      // Each source entry answers to its `storybook/*` key and to the owning package's key, so the
      // preview never loads a second instance (e.g. a second Emotion theme context) from `dist`.
      const sourceEntries: Array<[key: string, pkgKey: string, path: string]> = isDevelopment
        ? [
            ['storybook/internal/components', '@storybook/ui/internal/components', COMPONENTS_PATH],
            ['storybook/manager-api', '@storybook/manager/manager-api', MANAGER_API_PATH],
            ['storybook/preview-api', '@storybook/core/preview-api', PREVIEW_API_PATH],
            ['storybook/theming/create', '@storybook/ui/theming/create', THEMING_CREATE_PATH],
            ['storybook/theming', '@storybook/ui/theming', THEMING_PATH],
          ]
        : [
            // The components dist bundle inlines react-aria; resolving to source keeps the
            // preview on a single react-aria copy so FocusScopes can nest across modules.
            ['storybook/internal/components', '@storybook/ui/internal/components', COMPONENTS_PATH],
            ['storybook/manager-api', '@storybook/manager/manager-api', MANAGER_API_PATH],
            ['storybook/preview-api', '@storybook/core/preview-api', PREVIEW_API_PATH],
          ];

      return mergeConfig(viteConfig, {
        resolve: {
          alias: [
            ...sourceEntries.flatMap(([key, pkgKey, path]) =>
              [key, pkgKey].map((find) => ({ find: new RegExp(`^${find}$`), replacement: path }))
            ),
            ...(isDevelopment
              ? [{ find: /^sb-original\/image-context$/, replacement: IMAGE_CONTEXT_PATH }]
              : []),
          ],
        },
        // Vitest pre-bundles `storybook/test`, `storybook/preview-api` and what the bundles reach. A
        // twin left out is served unbundled next to the bundled copy: a second instance.
        ...(process.env.VITEST
          ? {
              optimizeDeps: {
                include: [
                  ...sourceEntries.flatMap(([key, pkgKey]) => [key, pkgKey]),
                  'storybook/test',
                  '@storybook/core/test',
                ].filter((key) => !key.endsWith('/manager-api')),
              },
            }
          : {}),
        plugins: [react()],
        build: {
          // disable sourcemaps in CI to not run out of memory
          sourcemap: process.env.CI !== 'true',
          target: BROWSER_TARGETS,
        },
        server: {
          watch: {
            // Something odd happens with tsconfig and nx which causes Storybook to keep reloading, so we ignore them
            ignored: [
              '**/.nx/cache/**',
              '**/tsconfig.json',
              // Internal e2e writes traces under code/playwright-results while the dev server is running.
              '**/playwright-results/**',
              '**/playwright-report/**',
            ],
          },
        },
      } satisfies InlineConfig);
    });
  },
}));
