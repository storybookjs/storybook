import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@storybook/react-dom-shim': '@storybook/react-dom-shim/dist/react-16',
    },
  },
});
