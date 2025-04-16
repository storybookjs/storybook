import { join } from 'node:path';

import react from '@vitejs/plugin-react';

import { defineMain } from '../frameworks/react-vite/src/node';

const componentsPath = join(__dirname, '../core/src/components/index.ts');
const managerApiPath = join(__dirname, '../core/src/manager-api/index.mock.ts');
const imageContextPath = join(__dirname, '../frameworks/nextjs/src/image-context.ts');

const config = defineMain({
  stories: [
    './*.stories.@(js|jsx|ts|tsx)',
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
      directory: '../lib/blocks/src',
      titlePrefix: 'blocks',
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
      directory: '../addons/vitest/src/components',
      titlePrefix: 'addons/vitest',
    },
    {
      directory: '../addons/vitest/template/stories',
      titlePrefix: 'addons/vitest',
    },
  ],
  addons: [
    '@storybook/addon-themes',
    '@storybook/addon-docs',
    '@storybook/addon-designs',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
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
  },
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
        target: ['chrome100'],
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
