import vue from '@vitejs/plugin-vue';
import { mergeConfig } from 'vite';

import { defineMain } from '@storybook/vue3-vite/node';

const managerDocs = process.env.MANAGER_DOCS !== '0';
const stories = [
  '../../../../../renderers/vue3/template/stories_vue3-vite-default-ts/SourceCode.stories.ts',
  '../../../../../renderers/vue3/template/stories_vue3-vite-default-ts/component-meta/TsComponent.stories.ts',
];

export default defineMain({
  stories: managerDocs ? [...stories, '../src/Vue.mdx'] : stories,
  addons: managerDocs ? ['@storybook/experimental-addon-manager-docs'] : [],
  framework: {
    name: '@storybook/vue3-vite',
    options: {
      docgen: false,
    },
  },
  core: {
    disableTelemetry: true,
  },
  async viteFinal(config) {
    return mergeConfig(config, {
      plugins: [vue()],
    });
  },
});
