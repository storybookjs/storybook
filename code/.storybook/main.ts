import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/react-vite/node';
import type { Options } from 'storybook/internal/types';

import react from '@vitejs/plugin-react';
import type { InlineConfig } from 'vite';

import { BROWSER_TARGETS } from '../core/src/shared/constants/environments-support.ts';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

const componentsPath = join(currentDirPath, '../core/src/components/index.ts');
const managerApiPath = join(currentDirPath, '../core/src/manager-api/index.mock.ts');
const previewApiPath = join(currentDirPath, '../core/src/preview-api/index.ts');
const themingCreatePath = join(currentDirPath, '../core/src/theming/create.ts');
const themingEmotionPath = join(currentDirPath, '../core/src/theming/emotion.ts');
const imageContextPath = join(currentDirPath, '../frameworks/nextjs/src/image-context.ts');

const config = defineMain({
  stories: [
    './bench/*.stories.@(js|jsx|ts|tsx)',
    {
      directory: '../core/template/stories',
      titlePrefix: 'core',
    },
    {
      directory: '../core/src/manager',
      titlePrefix: 'manager',
    },
    {
      directory: '../core/src/preview-api',
      titlePrefix: 'preview',
    },
    {
      directory: '../core/src/preview',
      titlePrefix: 'preview',
    },
    {
      directory: '../core/src/shared',
      titlePrefix: 'core/shared',
    },
    {
      directory: '../core/src/components/brand',
      titlePrefix: 'brand',
    },
    {
      directory: '../core/src/components/components',
      titlePrefix: 'components',
    },
    {
      directory: '../core/src/component-testing/components',
      titlePrefix: 'component-testing',
    },
    {
      directory: '../core/src/controls/components',
      titlePrefix: 'controls',
    },
    {
      directory: '../core/src/highlight',
      titlePrefix: 'highlight',
    },
    {
      directory: '../core/src/actions/containers',
      titlePrefix: 'actions',
    },
    {
      directory: '../addons/a11y/src',
      titlePrefix: 'addons/accessibility',
    },
    {
      directory: '../addons/a11y/template/stories',
      titlePrefix: 'addons/accessibility',
    },
    {
      directory: '../addons/docs/template/stories',
      titlePrefix: 'addons/docs',
    },
    {
      directory: '../addons/docs/src',
      titlePrefix: 'addons/docs',
    },
    {
      directory: '../addons/links/template/stories',
      titlePrefix: 'addons/links',
    },
    {
      directory: '../addons/themes/template/stories',
      titlePrefix: 'addons/themes',
    },
    {
      directory: '../addons/onboarding/src',
      titlePrefix: 'addons/onboarding',
    },
    {
      directory: '../addons/onboarding/example-stories',
    },
    {
      directory: '../addons/pseudo-states/src',
      titlePrefix: 'addons/pseudo-states',
    },
    {
      directory: '../addons/vitest/src/components',
      titlePrefix: 'addons/vitest',
    },
    {
      directory: '../addons/vitest/template/stories',
      titlePrefix: 'addons/vitest',
    },
    {
      directory: '../addons/vitest/src',
      titlePrefix: 'addons/vitest',
      files: 'stories.tsx',
    },
    {
      directory: '../renderers/react/src/__test__',
      titlePrefix: 'renderer/react',
      files: '@(ReactDomClient|RenderToCanvas).stories.tsx',
    },
  ],
  addons: [
    '@storybook/addon-onboarding',
    '@storybook/addon-themes',
    '@storybook/addon-docs',
    '@storybook/addon-designs',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-mcp',
    'storybook-addon-pseudo-states',
    '@chromatic-com/storybook',
    './services-preset.ts',
  ],
  previewAnnotations: [
    './core/template/stories/preview.ts',
    './renderers/react/template/components/index.js',
  ],
  build: {
    test: {
      // we have stories for the blocks here, we can't exclude them
      disableBlocks: false,
      // some stories in blocks (ArgTypes, Controls) depends on argTypes inference
      disableDocgen: false,
    },
  },
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  refs: {
    icons: {
      title: 'Icons',
      url: 'https://main--64b56e737c0aeefed9d5e675.chromatic.com',
      expanded: false,
    },
  },
  core: {
    disableTelemetry: true,
  },
  features: {
    developmentModeForBuild: true,
    experimentalTestSyntax: true,
    experimentalReactComponentMeta: true,
    experimentalSearchDocsHeadings: true,
  },
  staticDirs: [{ from: './bench/bundle-analyzer', to: '/bundle-analyzer' }],
  viteFinal: async (viteConfig: InlineConfig, { configType }: Options) => {
    const { mergeConfig } = await import('vite');

    return mergeConfig(viteConfig, {
      resolve: {
        alias:
          configType === 'DEVELOPMENT'
            ? [
                { find: 'storybook/internal/components', replacement: componentsPath },
                { find: 'storybook/manager-api', replacement: managerApiPath },
                { find: 'storybook/preview-api', replacement: previewApiPath },
                { find: 'storybook/theming/create', replacement: themingCreatePath },
                { find: 'storybook/theming/emotion', replacement: themingEmotionPath },
                // addon-designs still imports styled/css/jsx from storybook/theming.
                { find: /^storybook\/theming$/, replacement: themingEmotionPath },
                { find: 'sb-original/image-context', replacement: imageContextPath },
              ]
            : {
                // The components dist bundle inlines react-aria; resolving to source keeps the
                // preview on a single react-aria copy so FocusScopes can nest across modules.
                'storybook/internal/components': componentsPath,
                'storybook/manager-api': managerApiPath,
                'storybook/preview-api': previewApiPath,
              },
      },
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
    } satisfies typeof viteConfig);
  },
});

export default config;
