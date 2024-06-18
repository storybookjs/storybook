import path from 'path';
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { mergeConfig } from 'vite';
import type { StorybookConfig } from '../../frameworks/react-vite';

const isBlocksOnly = process.env.STORYBOOK_BLOCKS_ONLY === 'true';

const allStories = [
  {
    directory: '../manager/src',
    titlePrefix: '@manager',
  },
  {
    directory: '../../lib/preview-api/src',
    titlePrefix: '@preview',
  },
  {
    directory: '../components/src/components',
    titlePrefix: '@components',
  },
  {
    directory: '../blocks/src',
    titlePrefix: '@blocks',
  },
  {
    directory: '../../addons/controls/src', // TODO other addons?
    titlePrefix: '@addons/controls',
  },
  {
    directory: '../../addons/onboarding/src',
    titlePrefix: '@addons/onboarding',
  },
  {
    directory: '../../addons/interactions/src',
    titlePrefix: '@addons/interactions',
  },
];

/**
 * match all stories in blocks/src/blocks, blocks/src/controls and blocks/src/examples EXCEPT blocks/src/blocks/internal
 * Examples:
 *
 * src/blocks/Canvas.stories.tsx - MATCH
 * src/blocks/internal/InternalCanvas.stories.tsx - IGNORED, internal stories
 * src/blocks/internal/nested/InternalCanvas.stories.tsx - IGNORED, internal stories
 *
 * src/blocks/Canvas.tsx - IGNORED, not story
 * src/blocks/nested/Canvas.stories.tsx - MATCH
 * src/blocks/nested/deep/Canvas.stories.tsx - MATCH
 *
 * src/controls/Boolean.stories.tsx - MATCH
 * src/controls/Boolean.tsx - IGNORED, not story
 *
 * src/components/ColorPalette.stories.tsx - MATCH
 * src/components/ColorPalette.tsx - IGNORED, not story
 */
const blocksOnlyStories = [
  '../blocks/src/@(blocks|controls|examples)/!(internal)/**/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))',
  '../blocks/src/@(blocks|controls|examples)/*.@(mdx|stories.@(js|jsx|mjs|ts|tsx))',
];

const config: StorybookConfig = {
  stories: isBlocksOnly ? blocksOnlyStories : allStories,
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-storysource',
    '@storybook/addon-designs',
    '@storybook/addon-a11y',
    '@chromatic-com/storybook',
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
  core: {
    disableTelemetry: true,
  },
  viteFinal: (viteConfig, { configType }) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          ...(configType === 'DEVELOPMENT'
            ? { '@storybook/components': path.resolve(__dirname, '../components/src') }
            : {}),
        },
      },
      optimizeDeps: { force: true },
      build: {
        // disable sourcemaps in CI to not run out of memory
        sourcemap: process.env.CI !== 'true',
      },
    }),
  logLevel: 'debug',
};

export default config;
