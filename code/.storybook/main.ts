import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineMain } from '@storybook/react-vite/node';

import react from '@vitejs/plugin-react';

import { BROWSER_TARGETS } from '../core/src/shared/constants/environments-support.ts';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

const componentsPath = join(currentDirPath, '../core/src/components/index.ts');
const managerApiPath = join(currentDirPath, '../core/src/manager-api/index.mock.ts');
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
      directory: '../addons/docs/src/blocks',
      titlePrefix: 'addons/docs/blocks',
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
  ],
  addons: [
    '@storybook/addon-themes',
    '@storybook/addon-docs',
    '@storybook/addon-designs',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    'storybook-addon-pseudo-states',
    '@chromatic-com/storybook',
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
    experimentalComponentsManifest: true,
  },
  staticDirs: [{ from: './bench/bundle-analyzer', to: '/bundle-analyzer' }],
  viteFinal: async (viteConfig, { configType }) => {
    const { mergeConfig } = await import('vite');

    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          ...(configType === 'DEVELOPMENT'
            ? {
                'storybook/internal/components': componentsPath,
                'storybook/manager-api': managerApiPath,
                'sb-original/image-context': imageContextPath,
              }
            : {
                'storybook/manager-api': managerApiPath,
              }),
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
          ignored: ['**/.nx/cache/**', '**/tsconfig.json'],
        },
      },
    } satisfies typeof viteConfig);
  },
  // logLevel: 'debug',
});

export default config;
