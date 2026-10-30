import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    {
      name: 'storybook-addon-grid-overlay',
      options: { size: 16, color: 'rgba(2, 156, 253, 0.4)' },
    },
  ],
};

export default config;
