import { defineMain } from '@storybook/react-vite/node';

export default defineMain({
  stories: ['../src/Button.stories.tsx', '../src/Button.mdx'],
  addons: ['@storybook/experimental-addon-manager-docs'],
  framework: '@storybook/react-vite',
  core: {
    disableTelemetry: true,
  },
});
