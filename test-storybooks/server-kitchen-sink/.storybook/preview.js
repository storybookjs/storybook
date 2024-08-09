import { withLinks } from '@storybook/addon-links';

export const decorators = [withLinks];

const port = process.env.STORYBOOK_SERVER_PORT || 1337;

export const parameters = {
  docs: {
    story: { iframeHeight: '200px' },
  },
  server: {
    url: `http://localhost:${port}/storybook_preview`,
  },
};
