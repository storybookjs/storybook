import { defineMain } from 'storybook';

import gridOverlay from '../../addon-grid-overlay/src/node.ts';

export default defineMain({
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: [gridOverlay({ size: 16, color: 'rgba(2, 156, 253, 0.4)' })],
});
