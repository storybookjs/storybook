import onboarding from '@storybook/addon-onboarding/node';
import themes from '@storybook/addon-themes/node';
import docs from '@storybook/addon-docs/node';
import vitest from '@storybook/addon-vitest/node';
import a11y from '@storybook/addon-a11y/node';
import mcp from '@storybook/addon-mcp/node';
import pseudoStates from 'storybook-addon-pseudo-states/node';
import { reactVite } from '@storybook/react-vite/node';
import { defineMain } from 'storybook';

import { internalServices } from './services-addon.ts';
import { internalVite } from './vite-addon.ts';

const config = defineMain({
  stories: [
    './bench/*.stories.@(js|jsx|ts|tsx)',
    './module-instances.stories.tsx',
    {
      directory: '../lib/storybook/template/stories',
      titlePrefix: 'core',
    },
    {
      directory: '../lib/manager/src/ui',
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
      directory: '../lib/ui/src/components/brand',
      titlePrefix: 'brand',
    },
    {
      directory: '../lib/ui/src/components/components',
      titlePrefix: 'components',
    },
    {
      directory: '../lib/storybook/src/features/component-testing/components',
      titlePrefix: 'component-testing',
    },
    {
      directory: '../lib/storybook/src/features/controls/components',
      titlePrefix: 'controls',
    },
    {
      directory: '../lib/storybook/src/features/highlight',
      titlePrefix: 'highlight',
    },
    {
      directory: '../lib/storybook/src/features/actions/containers',
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
    onboarding(),
    themes(),
    docs(),
    '@storybook/addon-designs',
    vitest(),
    a11y(),
    mcp(),
    pseudoStates(),
    '@chromatic-com/storybook',
    internalVite(),
    internalServices(),
  ],
  previewAnnotations: [
    './lib/storybook/template/stories/preview.ts',
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
  framework: reactVite({}),
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
});

export default config;
