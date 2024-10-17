import { join } from 'node:path';

import { mergeConfig } from 'vite';

import type { StorybookConfig } from '../frameworks/react-vite';

const componentsPath = join(__dirname, '../core/src/components');
const managerApiPath = join(__dirname, '../core/src/manager-api');

const config: StorybookConfig = {
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
      directory: '../lib/blocks/src',
      titlePrefix: 'blocks',
    },
    {
      directory: '../addons/a11y/template/stories',
      titlePrefix: 'addons/a11y',
    },
    {
      directory: '../addons/actions/template/stories',
      titlePrefix: 'addons/actions',
    },
    {
      directory: '../addons/backgrounds/template/stories',
      titlePrefix: 'addons/backgrounds',
    },
    {
      directory: '../addons/controls/src',
      titlePrefix: 'addons/controls',
    },
    {
      directory: '../addons/controls/template/stories',
      titlePrefix: 'addons/controls',
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
      directory: '../addons/viewport/template/stories',
      titlePrefix: 'addons/viewport',
    },
    {
      directory: '../addons/toolbars/template/stories',
      titlePrefix: 'addons/toolbars',
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
      directory: '../addons/interactions/src',
      titlePrefix: 'addons/interactions',
    },
    // {
    //   directory: '../addons/interactions/template/stories',
    //   titlePrefix: 'addons/interactions',
    // },
  ],
  addons: [
    '@storybook/addon-themes',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-storysource',
    '@storybook/addon-designs',
    '@storybook/experimental-addon-test',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook',
  ],
  previewAnnotations: [
    './core/template/stories/preview.ts',
    './addons/toolbars/template/stories/preview.ts',
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
    viewportStoryGlobals: true,
    backgroundsStoryGlobals: true,
  },
  viteFinal: async (viteConfig, { configType }) => {
    return mergeConfig(viteConfig, {
      resolve: {
        alias: {
          ...(configType === 'DEVELOPMENT'
            ? {
                '@storybook/components': componentsPath,
                'storybook/internal/components': componentsPath,
                '@storybook/manager-api': managerApiPath,
                'storybook/internal/manager-api': managerApiPath,
              }
            : {}),
        },
      },
      optimizeDeps: {
        force: true,
        include: ['@storybook/blocks'],
      },
      build: {
        // disable sourcemaps in CI to not run out of memory
        sourcemap: process.env.CI !== 'true',
      },
    } satisfies typeof viteConfig);
  },
  // logLevel: 'debug',
};

// console.log({__filename, __dirname});

// console.log(require.resolve('./main.ts'))

export default config;
