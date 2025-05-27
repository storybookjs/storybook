import { lt } from 'semver';

import { createBlocker } from './types';
import { findOutdatedPackage } from './utils';

const minimalVersionsMap = {
  '@storybook/preact-webpack5': '9.0.0',
  '@storybook/preset-preact-webpack': '9.0.0',
  '@storybook/vue3-webpack5': '9.0.0',
  '@storybook/preset-vue3-webpack': '9.0.0',
  '@storybook/html-webpack5': '9.0.0',
  '@storybook/preset-html-webpack': '9.0.0',
  '@storybook/web-components-webpack5': '9.0.0',
} as const;

export const blocker = createBlocker({
  id: 'dependenciesVersions',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-webpack5-builder-support-in-favor-of-vite',
  async check({ packageManager }) {
    return findOutdatedPackage<typeof minimalVersionsMap>(minimalVersionsMap, { packageManager });
  },
  log(data) {
    switch (data.packageName) {
      case '@storybook/preact-webpack5':
      case '@storybook/preset-preact-webpack':
        return 'Support for Preact Webpack5 has been removed.';
      case '@storybook/vue3-webpack5':
      case '@storybook/preset-vue3-webpack':
        return 'Support for Vue3 Webpack5 has been removed.';
      case '@storybook/html-webpack5':
      case '@storybook/preset-html-webpack':
        return 'Support for HTML Webpack5 has been removed.';
      case '@storybook/web-components-webpack5':
        return 'Support for Web Components Webpack5 has been removed.';
    }
  },
});
