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
  '@storybook/svelte-webpack5': '9.0.0',
} as const;

export const blocker = createBlocker({
  id: 'dependenciesVersions',
  async check({ packageManager }) {
    return findOutdatedPackage<typeof minimalVersionsMap>(minimalVersionsMap, { packageManager });
  },
  log(data) {
    const additionalInfo =
      'Please migrate your Webpack5-based frameworks to their Vite equivalents.';
    const link =
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-webpack5-builder-support-in-favor-of-vite';

    let title: string;

    switch (data.packageName) {
      case '@storybook/preact-webpack5':
      case '@storybook/preset-preact-webpack':
        title = 'Preact Webpack5 support removed';
        break;
      case '@storybook/vue3-webpack5':
      case '@storybook/preset-vue3-webpack':
        title = 'Vue3 Webpack5 support removed';
        break;
      case '@storybook/html-webpack5':
      case '@storybook/preset-html-webpack':
        title = 'HTML Webpack5 support removed';
        break;
      case '@storybook/web-components-webpack5':
        title = 'Web Components Webpack5 support removed';
        break;
      case '@storybook/svelte-webpack5':
        title = 'Svelte Webpack5 support removed';
        break;
    }

    return {
      title,
      message: additionalInfo,
      link,
    };
  },
});
