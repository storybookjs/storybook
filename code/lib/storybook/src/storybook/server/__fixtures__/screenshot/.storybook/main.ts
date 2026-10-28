import { reactVite } from '@storybook/react-vite/node';

export default {
  framework: reactVite(),
  stories: ['../*.stories.tsx'],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
};
